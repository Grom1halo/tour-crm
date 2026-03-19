#!/usr/bin/env node
/**
 * sync-from-sql-file.js
 * Reads vouchers_only.sql directly (no MySQL needed) and upserts new
 * vouchers into PostgreSQL tour_crm.
 *
 * Usage:
 *   node sync-from-sql-file.js [--dry-run] [--from-date=2025-04-02] [--all]
 *   node sync-from-sql-file.js --file="C:\Users\1\Downloads\vouchers_only.sql"
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ── Config ─────────────────────────────────────────────────────────────────
const PG_CONFIG = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD ,
  database: process.env.PG_DB       || 'tour_crm',
};

const DRY_RUN   = process.argv.includes('--dry-run');
const SYNC_ALL  = process.argv.includes('--all');
const FROM_DATE = (() => {
  const a = process.argv.find(a => a.startsWith('--from-date='));
  return a ? a.split('=')[1] : null;
})();
const SQL_FILE  = (() => {
  const a = process.argv.find(a => a.startsWith('--file='));
  return a ? a.split('=').slice(1).join('=').replace(/^"|"$/g, '') : null;
})() || 'C:\\Users\\1\\Downloads\\vouchers_only.sql';

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }
function f(v)      { const n = parseFloat(v); return isNaN(n) ? null : n; }
function s(v)      { return v === null || v === undefined ? null : v.toString().trim() || null; }

function deriveTourType(row) {
  if (row.tur_flot_flag   == 1) return 'tourflot';
  if (row.individual_tour == 1) return 'individual';
  return 'group';
}
function derivePaymentStatus(row) {
  if (row.voucher_paid == 1) return 'paid';
  if (parseFloat(row.price_deposit || 0) > 0) return 'partial';
  return 'unpaid';
}

// ── SQL value parser ────────────────────────────────────────────────────────
// Parses one SQL VALUES row like: (1, 'hello', NULL, 3.14, ...)
// Returns array of JS values (strings / numbers / null)
function parseRow(src, pos) {
  // pos should point to '('
  if (src[pos] !== '(') return null;
  pos++; // skip '('
  const values = [];
  while (pos < src.length) {
    // skip whitespace
    while (pos < src.length && (src[pos] === ' ' || src[pos] === '\n' || src[pos] === '\r' || src[pos] === '\t')) pos++;
    if (src[pos] === ')') { pos++; break; }
    if (src[pos] === ',') { pos++; continue; }

    if (src.startsWith('NULL', pos)) {
      values.push(null);
      pos += 4;
    } else if (src[pos] === "'") {
      // quoted string
      pos++; // skip opening '
      let str = '';
      while (pos < src.length) {
        if (src[pos] === '\\' && pos + 1 < src.length) {
          // backslash escape
          const next = src[pos + 1];
          if      (next === 'n')  { str += '\n'; pos += 2; }
          else if (next === 'r')  { str += '\r'; pos += 2; }
          else if (next === 't')  { str += '\t'; pos += 2; }
          else if (next === "'")  { str += "'";  pos += 2; }
          else if (next === '\\') { str += '\\'; pos += 2; }
          else                    { str += next; pos += 2; }
        } else if (src[pos] === "'" && src[pos + 1] === "'") {
          // doubled single-quote escape
          str += "'"; pos += 2;
        } else if (src[pos] === "'") {
          pos++; break; // end of string
        } else {
          str += src[pos++];
        }
      }
      values.push(str);
    } else {
      // number or bare word
      let num = '';
      while (pos < src.length && src[pos] !== ',' && src[pos] !== ')' && src[pos] !== ' ') {
        num += src[pos++];
      }
      if (num === 'NULL') values.push(null);
      else values.push(num);
    }
  }
  return { values, endPos: pos };
}

// ── Parse entire SQL file for INSERT INTO `vouchers` ───────────────────────
function parseVouchersFromSql(filePath) {
  log(`Reading SQL file: ${filePath}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  log(`File size: ${(raw.length / 1024 / 1024).toFixed(1)} MB`);

  const rows = [];
  let columns = null;

  // Find all INSERT INTO `vouchers` blocks
  const insertRe = /INSERT INTO `vouchers` \(([^)]+)\) VALUES\s*/g;
  let m;
  while ((m = insertRe.exec(raw)) !== null) {
    // Parse column names
    const colStr = m[1];
    const cols = colStr.split(',').map(c => c.trim().replace(/`/g, ''));
    if (!columns) {
      columns = cols;
      log(`Columns (${cols.length}): ${cols.join(', ')}`);
    }

    // Now parse rows starting at m.index + m[0].length
    let pos = m.index + m[0].length;
    while (pos < raw.length) {
      // skip whitespace
      while (pos < raw.length && (raw[pos] === ' ' || raw[pos] === '\n' || raw[pos] === '\r' || raw[pos] === '\t')) pos++;
      if (raw[pos] !== '(') break; // end of VALUES list

      const result = parseRow(raw, pos);
      if (!result) break;
      pos = result.endPos;

      // Build object
      const obj = {};
      cols.forEach((c, i) => { obj[c] = result.values[i] ?? null; });
      rows.push(obj);

      // skip comma or semicolon
      while (pos < raw.length && (raw[pos] === ',' || raw[pos] === ' ' || raw[pos] === '\n' || raw[pos] === '\r')) {
        if (raw[pos] === ';') break;
        pos++;
      }
    }
  }

  log(`Parsed ${rows.length} rows from SQL file`);
  return rows;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE SYNC'}`);
  log(`SQL file: ${SQL_FILE}`);

  // Connect to PostgreSQL
  log('Connecting to PostgreSQL…');
  const pg = new Pool(PG_CONFIG);
  await pg.query('SELECT 1');
  log('PostgreSQL connected');

  // Determine cutoff date
  let cutoffDate;
  if (SYNC_ALL) {
    cutoffDate = '2000-01-01';
    log('Syncing ALL vouchers');
  } else if (FROM_DATE) {
    cutoffDate = FROM_DATE;
    log(`From date: ${cutoffDate}`);
  } else {
    const res = await pg.query(`SELECT MAX(created_at)::date AS d FROM vouchers WHERE created_at IS NOT NULL`);
    const maxDate = res.rows[0]?.d;
    if (maxDate) {
      const d = new Date(maxDate);
      d.setDate(d.getDate() - 7);
      cutoffDate = d.toISOString().split('T')[0];
      log(`Auto-detected cutoff: ${cutoffDate} (PG latest: ${maxDate})`);
    } else {
      cutoffDate = '2000-01-01';
    }
  }

  // Load users/companies/agents lookup maps from PG
  const [usersRes, companiesRes, agentsRes] = await Promise.all([
    pg.query('SELECT id, username FROM users'),
    pg.query('SELECT id, name FROM companies'),
    pg.query('SELECT id, name FROM agents'),
  ]);
  const usersByUsername  = new Map(usersRes.rows.map(r => [r.username?.toLowerCase(), r.id]));
  const companiesById    = new Map(companiesRes.rows.map(r => [r.id, r.id]));  // old id → pg id (same after migration)
  const agentsByName     = new Map(agentsRes.rows.map(r => [r.name?.toLowerCase()?.trim(), r.id]));

  // Also load old MySQL user IDs → PG manager IDs mapping
  // We'll try to match by looking at managers table
  const pgManagers = await pg.query('SELECT id, manager_number FROM users');
  const managerByNum = new Map(pgManagers.rows.map(r => [String(r.manager_number), r.id]));

  // Parse SQL file
  const allRows = parseVouchersFromSql(SQL_FILE);

  // Filter by cutoff
  const newRows = allRows.filter(r => {
    if (!r.created_at) return false;
    return r.created_at > cutoffDate + ' 23:59:59';
  });
  log(`Rows after ${cutoffDate}: ${newRows.length}`);

  if (newRows.length === 0) {
    log('Nothing to sync. Done.');
    await pg.end();
    return;
  }

  // Load existing PG voucher numbers to avoid duplicates
  const existingRes = await pg.query('SELECT voucher_number FROM vouchers');
  const existingNums = new Set(existingRes.rows.map(r => r.voucher_number));
  log(`Existing PG vouchers: ${existingNums.size}`);

  // Process companies/agents/clients from new rows
  let inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (const row of newRows) {
    try {
      const voucherNum = s(row.voucher_number);
      if (!voucherNum) { skipped++; continue; }

      // ── Resolve manager ──────────────────────────────────────────────────
      const managerId = row.voucher_created_user_id
        ? (managerByNum.get(String(row.voucher_created_user_id)) || null)
        : null;

      // ── Resolve or create client ─────────────────────────────────────────
      const clientName  = s(row.client_name);
      const clientPhone = s(row.client_phone);
      let clientId = null;
      if ((clientName || clientPhone) && !DRY_RUN) {
        // Try to find existing client first
        const phone = clientPhone || '';
        const findQ = managerId
          ? await pg.query('SELECT id FROM clients WHERE phone=$1 AND manager_id=$2 LIMIT 1', [phone, managerId])
          : await pg.query('SELECT id FROM clients WHERE phone=$1 AND manager_id IS NULL LIMIT 1', [phone]);
        if (findQ.rows.length > 0) {
          clientId = findQ.rows[0].id;
        } else {
          const cr = await pg.query(
            'INSERT INTO clients (name, phone, manager_id, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW()) RETURNING id',
            [clientName || '', phone, managerId]
          );
          clientId = cr.rows[0]?.id;
        }
      }

      // ── Resolve or create agent ──────────────────────────────────────────
      const agentNameRaw = s(row.agent_name);
      let agentId = null;
      if (agentNameRaw) {
        const key = agentNameRaw.toLowerCase();
        agentId = agentsByName.get(key) || null;
        if (!agentId && !DRY_RUN) {
          const ar = await pg.query(
            'INSERT INTO agents (name, is_active, commission_percentage, created_at, updated_at) VALUES ($1, true, 0, NOW(), NOW()) RETURNING id',
            [agentNameRaw]);
          agentId = ar.rows[0]?.id;
          agentsByName.set(key, agentId);
        }
      }

      // ── Derive fields ────────────────────────────────────────────────────
      const tourType      = deriveTourType(row);
      const paymentStatus = derivePaymentStatus(row);
      const isImportant   = row.voucher_important == 1;
      const isDeleted     = row.deleted_at != null;
      let remarks = s(row.voucher_remarks) || '';
      if (isImportant && !remarks.startsWith('[ВАЖНО]')) remarks = '[ВАЖНО] ' + remarks;

      const totalSale    = f(row.price_total)     || f(row.price_individual) || 0;
      const paidToAgency = f(row.price_nett_total) || f(row.price_deposit)   || 0;
      const cashOnTour   = f(row.price_cash_on_tour) || 0;

      // Company: try to match by old id
      const companyId = row.company_id ? (companiesById.get(parseInt(row.company_id)) || null) : null;

      if (DRY_RUN) {
        log(`  [DRY] ${existingNums.has(voucherNum) ? 'UPDATE' : 'INSERT'} voucher ${voucherNum} | ${s(row.client_name)} | ${row.created_at}`);
        inserted++;
        continue;
      }

      // ── Upsert voucher (manual insert-or-update) ────────────────────────
      const vals = [
        voucherNum, tourType, companyId, clientId, managerId, agentId,
        s(row.hotel_name), s(row.hotel_room_number),
        parseInt(row.client_count_adults||0), parseInt(row.client_count_child||0), parseInt(row.client_count_infant||0),
        row.client_datetime_trip,
        f(row.price_adult), f(row.price_child), f(row.price_transfer), f(row.price_other), totalSale,
        f(row.price_nett_adult), f(row.price_nett_child), f(row.price_nett_transfer), f(row.price_nett_other), paidToAgency,
        paidToAgency, cashOnTour, f(row.agent_commission),
        paymentStatus, remarks || null, s(row.voucher_cancellations),
        isImportant, isDeleted, row.deleted_at || null,
        row.created_at, row.updated_at || row.created_at,
      ];

      if (existingNums.has(voucherNum)) {
        // UPDATE existing
        await pg.query(`
          UPDATE vouchers SET
            updated_at = $2, payment_status = $3, paid_to_agency = $4,
            cash_on_tour = $5, remarks = $6, is_deleted = $7, deleted_at = $8,
            total_sale = $9, total_net = $10
          WHERE voucher_number = $1`,
          [voucherNum,
           row.updated_at || row.created_at, paymentStatus, paidToAgency,
           cashOnTour, remarks || null, isDeleted, row.deleted_at || null,
           totalSale, paidToAgency]);
        updated++;
      } else {
        // INSERT new
        await pg.query(`
          INSERT INTO vouchers (
            voucher_number, tour_type, company_id, client_id, manager_id, agent_id,
            hotel_name, room_number,
            adults, children, infants, tour_date,
            adult_sale, child_sale, transfer_sale, other_sale, total_sale,
            adult_net, child_net, transfer_net, other_net, total_net,
            paid_to_agency, cash_on_tour, agent_commission_percentage,
            payment_status, remarks, cancellation_notes,
            is_important, is_deleted, deleted_at, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
            $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
            $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
          )`, vals);
        existingNums.add(voucherNum);
        inserted++;
      }

    } catch (e) {
      errors++;
      warn(`Voucher ${row.voucher_number}: ${e.message}`);
    }
  }

  log('─────────────────────────────────');
  log(`Inserted: ${inserted}`);
  log(`Updated:  ${updated}`);
  log(`Skipped:  ${skipped}`);
  log(`Errors:   ${errors}`);
  log('Done.');

  await pg.end();
}

main().catch(e => { console.error(e); process.exit(1); });
