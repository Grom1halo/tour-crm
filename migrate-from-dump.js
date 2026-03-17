#!/usr/bin/env node
/**
 * Migration script: MySQL SQL dump → PostgreSQL (tour_crm)
 *
 * Reads directly from a .sql dump file — no MySQL installation required.
 *
 * Prerequisites:
 *   npm install pg
 *   (pg is already in backend/node_modules, or install globally)
 *
 * Usage:
 *   node migrate-from-dump.js [--dry-run] [--file path/to/dump.sql]
 *
 * Defaults:
 *   --file  C:/Users/1/Downloads/cn81466_voucher2.sql
 *
 * Environment variables for PostgreSQL:
 *   PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DB
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const DUMP_FILE = (() => {
  const idx = process.argv.indexOf('--file');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return 'C:/Users/1/Downloads/cn81466_voucher2.sql';
})();

const PG_CONFIG = {
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB       || 'tour_crm',
};

const DRY_RUN = process.argv.includes('--dry-run');

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }
function err(msg)  { console.error(`[ERROR] ${msg}`); }

function f(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function s(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function int(v) { const n = parseInt(v); return isNaN(n) ? 0 : n; }

function deriveTourType(row) {
  if (int(row.tur_flot_flag)  === 1) return 'tourflot';
  if (int(row.individual_tour) === 1) return 'individual';
  return 'group';
}

function derivePaymentStatus(row) {
  if (int(row.voucher_paid) === 1) return 'paid';
  if (f(row.price_deposit) > 0)   return 'partial';
  return 'unpaid';
}

// ─── SQL DUMP PARSER ───────────────────────────────────────────────────────────
/**
 * Parses a MySQL dump and returns rows for specified tables.
 * Returns: { tableName: [ {col: val, ...}, ... ] }
 *
 * Handles:
 *  - NULL values
 *  - Escaped strings  \'  \\
 *  - Multi-row INSERT blocks
 *  - Multiple INSERT blocks for the same table
 */
function parseDump(filePath, tables) {
  log(`Reading dump file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const result  = {};
  for (const t of tables) result[t] = [];

  // Match: INSERT INTO `table` (`cols`) VALUES\n(row),(row),...;
  const insertRe = /INSERT INTO `(\w+)` \(([^)]+)\) VALUES\s*([\s\S]*?);(?:\n|$)/g;
  let match;

  while ((match = insertRe.exec(content)) !== null) {
    const tableName = match[1];
    if (!tables.includes(tableName)) continue;

    const cols = match[2].split(',').map(c => c.trim().replace(/`/g, ''));
    const valuesBlock = match[3];

    // Parse individual row tuples
    const rows = parseValueRows(valuesBlock);

    for (const rowValues of rows) {
      if (rowValues.length !== cols.length) {
        warn(`${tableName}: column count mismatch (${cols.length} cols, ${rowValues.length} vals) — skipped`);
        continue;
      }
      const obj = {};
      cols.forEach((c, i) => { obj[c] = rowValues[i]; });
      result[tableName].push(obj);
    }
  }

  for (const t of tables) {
    log(`  ${t}: ${result[t].length} rows`);
  }
  return result;
}

/**
 * Splits a VALUES block into individual row arrays.
 * Handles nested strings with escaped quotes.
 */
function parseValueRows(block) {
  const rows = [];
  let i = 0;
  const len = block.length;

  while (i < len) {
    // Find opening '('
    while (i < len && block[i] !== '(') i++;
    if (i >= len) break;
    i++; // skip '('

    const values = [];
    let current = '';
    let inString = false;
    let strChar = '';

    while (i < len) {
      const ch = block[i];

      if (inString) {
        if (ch === '\\' && i + 1 < len) {
          // Escaped character
          const next = block[i + 1];
          if      (next === "'")  { current += "'";  i += 2; continue; }
          else if (next === '"')  { current += '"';  i += 2; continue; }
          else if (next === '\\') { current += '\\'; i += 2; continue; }
          else if (next === 'n')  { current += '\n'; i += 2; continue; }
          else if (next === 'r')  { current += '\r'; i += 2; continue; }
          else if (next === 't')  { current += '\t'; i += 2; continue; }
          else { current += ch; i++; continue; }
        }
        if (ch === strChar) {
          inString = false;
          i++;
          continue;
        }
        current += ch;
        i++;
        continue;
      }

      // Not in string
      if (ch === "'" || ch === '"') {
        inString = true;
        strChar  = ch;
        i++;
        continue;
      }

      if (ch === ',') {
        values.push(parseScalar(current.trim()));
        current = '';
        i++;
        continue;
      }

      if (ch === ')') {
        values.push(parseScalar(current.trim()));
        rows.push(values);
        i++;
        break;
      }

      current += ch;
      i++;
    }
  }
  return rows;
}

function parseScalar(v) {
  if (v === 'NULL' || v === '') return null;
  return v;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE MIGRATION'}`);

  // 1. Parse dump
  const data = parseDump(DUMP_FILE, ['users', 'companies', 'company_tours', 'vouchers']);

  const { users, companies, company_tours, vouchers } = data;

  // 2. Build deduplicated lookup maps

  // Clients: key = "phone|manager_id"
  const clientMap = new Map();
  for (const v of vouchers) {
    const phone = s(v.client_phone);
    const name  = s(v.client_name);
    const mgr   = v.voucher_created_user_id;
    if (!phone && !name) continue;
    const key = `${phone}|${mgr}`;
    if (!clientMap.has(key)) clientMap.set(key, { name, phone, manager_id: mgr });
  }

  // Agents: key = lower name
  const agentMap = new Map();
  for (const v of vouchers) {
    const name = s(v.agent_name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!agentMap.has(key)) agentMap.set(key, { name });
  }

  log(`  unique clients: ${clientMap.size}`);
  log(`  unique agents:  ${agentMap.size}`);

  // 3. DRY RUN preview
  if (DRY_RUN) {
    console.log('\n=== DRY RUN PREVIEW ===');
    console.log(`\nUsers (${users.length}):`);
    users.slice(0, 3).forEach(u =>
      console.log(`  id=${u.id}  name="${u.name}"  email="${u.email}"  percent=${u.manager_percent}`));

    console.log(`\nCompanies (${companies.length}):`);
    companies.slice(0, 5).forEach(c =>
      console.log(`  id=${c.id}  name="${c.name}"`));

    console.log(`\nTours (${company_tours.length}):`);
    company_tours.slice(0, 5).forEach(t =>
      console.log(`  id=${t.id}  company=${t.company_id}  tour="${t.tour_name}"  nett_adult=${t.price_nett_adult}`));

    console.log(`\nVouchers (${vouchers.length}) — first 3:`);
    vouchers.slice(0, 3).forEach(v =>
      console.log(`  #${v.voucher_number}  client="${v.client_name}"  agent="${v.agent_name}"  type=${deriveTourType(v)}  deposit=${v.price_deposit}  paid=${v.voucher_paid}`));

    console.log(`\nClients to create: ${clientMap.size}`);
    console.log(`Agents to create:  ${agentMap.size}`);
    console.log('\nDry run done. Remove --dry-run to migrate.');
    return;
  }

  // 4. Connect to PostgreSQL
  log('Connecting to PostgreSQL…');
  const pg = new Pool(PG_CONFIG);
  await pg.query('SELECT 1');

  const db = await pg.connect();
  try {
    await db.query('BEGIN');

    // ── 4a. Users ────────────────────────────────────────────────────────────
    log('Migrating users…');
    const userIdMap = new Map(); // old_id → new_id

    for (const u of users) {
      const username = s(u.email).split('@')[0]
        || s(u.name).toLowerCase().replace(/\s+/g, '_')
        || `user_${u.id}`;
      const fullName = s(u.name) || username;

      const res = await db.query(
        `INSERT INTO users (username, password_hash, full_name, role, commission_percentage, is_active)
         VALUES ($1, $2, $3, 'manager', $4, true)
         ON CONFLICT (username) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               commission_percentage = EXCLUDED.commission_percentage
         RETURNING id`,
        [username, u.password || '$2b$10$placeholder', fullName, f(u.manager_percent)]
      );
      userIdMap.set(String(u.id), res.rows[0].id);
    }
    log(`  users: ${userIdMap.size}`);

    // ── 4b. Companies ─────────────────────────────────────────────────────────
    log('Migrating companies…');
    const companyIdMap = new Map(); // old_id → new_id

    for (const c of companies) {
      if (!s(c.name)) continue;
      const res = await db.query(
        `INSERT INTO companies (name, is_active)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [s(c.name), c.deleted_at === null]
      );
      companyIdMap.set(String(c.id), res.rows[0].id);
    }
    log(`  companies: ${companyIdMap.size}`);

    // ── 4c. Tours ─────────────────────────────────────────────────────────────
    log('Migrating tours (company_tours)…');
    const tourIdMap = new Map(); // old company_tour id → new tour id

    for (const t of company_tours) {
      const name = s(t.tour_name);
      if (!name) continue;

      let newTourId;
      const existing = await db.query('SELECT id FROM tours WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        newTourId = existing.rows[0].id;
      } else {
        const res = await db.query(
          `INSERT INTO tours (name, tour_type, is_active)
           VALUES ($1, 'group', $2)
           RETURNING id`,
          [name, t.deleted_at === null]
        );
        newTourId = res.rows[0].id;
      }
      tourIdMap.set(String(t.id), newTourId);

      const newCompanyId = companyIdMap.get(String(t.company_id));
      if (newCompanyId) {
        await db.query(
          `INSERT INTO tour_prices
             (tour_id, company_id, valid_from, valid_to,
              adult_net, child_net, infant_net, transfer_net, other_net,
              adult_sale, child_sale, infant_sale, transfer_sale, other_sale)
           VALUES ($1,$2,'2020-01-01','2099-12-31',$3,$4,0,0,0,$3,$4,0,0,0)
           ON CONFLICT DO NOTHING`,
          [newTourId, newCompanyId, f(t.price_nett_adult), f(t.price_nett_child)]
        );
      }
    }
    log(`  tours: ${tourIdMap.size}`);

    // ── 4d. Agents ────────────────────────────────────────────────────────────
    log('Migrating agents…');
    const agentNewIdMap = new Map(); // lower_name → new_id

    for (const [key, a] of agentMap) {
      let newId;
      const existing = await db.query('SELECT id FROM agents WHERE LOWER(name) = $1', [key]);
      if (existing.rows.length > 0) {
        newId = existing.rows[0].id;
      } else {
        const res = await db.query(
          `INSERT INTO agents (name, commission_percentage, is_active)
           VALUES ($1, 0, true) RETURNING id`,
          [a.name]
        );
        newId = res.rows[0].id;
      }
      agentNewIdMap.set(key, newId);
    }
    log(`  agents: ${agentNewIdMap.size}`);

    // ── 4e. Clients ───────────────────────────────────────────────────────────
    log('Migrating clients…');
    const clientNewIdMap = new Map(); // "phone|old_manager_id" → new client_id

    for (const [key, c] of clientMap) {
      const newManagerId = userIdMap.get(String(c.manager_id));
      if (!newManagerId) {
        warn(`Client "${c.name}" skipped: manager ${c.manager_id} not found`);
        continue;
      }
      const res = await db.query(
        `INSERT INTO clients (name, phone, manager_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (phone, manager_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [c.name || 'Unknown', c.phone || '', newManagerId]
      );
      clientNewIdMap.set(key, res.rows[0].id);
    }
    log(`  clients: ${clientNewIdMap.size}`);

    // ── 4f. Vouchers ──────────────────────────────────────────────────────────
    log('Migrating vouchers…');
    await db.query('ALTER TABLE vouchers DISABLE TRIGGER trigger_update_voucher_totals');

    let vOk = 0, vSkip = 0;
    const voucherIdMap = new Map();

    for (const v of vouchers) {
      try {
        const tourType      = deriveTourType(v);
        const paymentStatus = derivePaymentStatus(v);

        const newManagerId = userIdMap.get(String(v.voucher_created_user_id));
        const newCompanyId = companyIdMap.get(String(v.company_id)) || null;
        const newTourId    = tourIdMap.get(String(v.company_tour_id)) || null;

        const agentKey   = s(v.agent_name).toLowerCase();
        const newAgentId = agentKey ? (agentNewIdMap.get(agentKey) || null) : null;

        const clientKey   = `${s(v.client_phone)}|${v.voucher_created_user_id}`;
        const newClientId = clientNewIdMap.get(clientKey) || null;

        const isIndividual = int(v.individual_tour) === 1;
        const adultSale    = f(isIndividual ? v.price_individual       : v.price_adult);
        const adultNet     = f(isIndividual ? v.price_nett_individual   : v.price_nett_adult);
        const childSale    = f(v.price_child);
        const childNet     = f(v.price_nett_child);
        const transferSale = f(v.price_transfer);
        const transferNet  = f(v.price_nett_transfer);
        const otherSale    = f(v.price_other);
        const otherNet     = f(v.price_nett_other);

        const adults   = int(v.client_count_adults);
        const children = int(v.client_count_child);
        const infants  = int(v.client_count_infant);

        const totalNet  = adults * adultNet  + children * childNet
                        + (adults + children) * transferNet  + otherNet;
        const totalSale = adults * adultSale + children * childSale
                        + (adults + children) * transferSale + otherSale;

        const paidToAgency = f(v.price_deposit);
        const cashOnTour   = totalSale - paidToAgency;

        const agentCommAmt = f(v.agent_commission);
        const agentCommPct = totalSale > 0
          ? parseFloat((agentCommAmt / totalSale * 100).toFixed(2))
          : 0;

        let remarks = s(v.voucher_remarks);
        if (int(v.voucher_important) === 1) remarks = `[ВАЖНО] ${remarks}`.trim();
        if (s(v.voucher_cancellations))     remarks += ` | Отмена: ${s(v.voucher_cancellations)}`;
        remarks = remarks.trim() || null;

        let tourDate = null, tourTime = null;
        if (v.client_datetime_trip) {
          const dt = new Date(v.client_datetime_trip);
          if (!isNaN(dt)) {
            tourDate = dt.toISOString().split('T')[0];
            tourTime = dt.toTimeString().split(' ')[0];
          }
        }
        if (!tourDate) {
          tourDate = v.created_at
            ? new Date(v.created_at).toISOString().split('T')[0]
            : '2020-01-01';
        }

        const isDeleted = v.deleted_at !== null;

        const res = await db.query(
          `INSERT INTO vouchers (
             voucher_number, tour_type,
             client_id, manager_id, company_id, tour_id, agent_id,
             tour_date, tour_time, hotel_name, room_number,
             adults, children, infants,
             adult_net, child_net, infant_net, transfer_net, other_net,
             adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
             total_net, total_sale, paid_to_agency, cash_on_tour,
             payment_status, agent_commission_percentage,
             remarks, is_deleted, deleted_at, created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,
             $20,$21,$22,$23,$24,$25,$26,$27,$28,
             $29,$30,$31,$32,$33,$34,$35
           )
           ON CONFLICT (voucher_number) DO NOTHING
           RETURNING id`,
          [
            s(v.voucher_number), tourType,
            newClientId, newManagerId, newCompanyId, newTourId, newAgentId,
            tourDate, tourTime,
            s(v.hotel_name) || null, s(v.hotel_room_number) || null,
            adults, children, infants,
            adultNet, childNet, 0, transferNet, otherNet,
            adultSale, childSale, 0, transferSale, otherSale,
            totalNet, totalSale, paidToAgency, cashOnTour,
            paymentStatus, agentCommPct,
            remarks, isDeleted, v.deleted_at || null,
            v.created_at || new Date(), v.updated_at || new Date(),
          ]
        );

        if (res.rows.length > 0) {
          voucherIdMap.set(String(v.id), res.rows[0].id);
          vOk++;
        } else {
          vSkip++;
        }
      } catch (e) {
        err(`Voucher ${v.voucher_number}: ${e.message}`);
        vSkip++;
      }
    }

    await db.query('ALTER TABLE vouchers ENABLE TRIGGER trigger_update_voucher_totals');
    log(`  vouchers: ${vOk} OK, ${vSkip} skipped`);

    // ── 4g. Payments (from price_deposit) ─────────────────────────────────────
    log('Migrating payments…');
    let pOk = 0;

    for (const v of vouchers) {
      const deposit = f(v.price_deposit);
      if (deposit <= 0 || v.deleted_at !== null) continue;

      const newVoucherId = voucherIdMap.get(String(v.id));
      if (!newVoucherId) continue;

      const method = s(v.voucher_money).toUpperCase() || 'cash';
      await db.query(
        `INSERT INTO payments (voucher_id, payment_date, amount, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          newVoucherId,
          v.created_at || new Date(),
          deposit, method,
          `Migrated from price_deposit (${method})`,
          userIdMap.get(String(v.voucher_created_user_id)) || null,
        ]
      );
      pOk++;
    }
    log(`  payments: ${pOk}`);

    // ── Commit ────────────────────────────────────────────────────────────────
    await db.query('COMMIT');

    console.log('\n╔══════════════════════════════╗');
    console.log('║   MIGRATION COMPLETE ✓       ║');
    console.log('╠══════════════════════════════╣');
    console.log(`║  users:     ${String(userIdMap.size).padEnd(18)}║`);
    console.log(`║  companies: ${String(companyIdMap.size).padEnd(18)}║`);
    console.log(`║  tours:     ${String(tourIdMap.size).padEnd(18)}║`);
    console.log(`║  agents:    ${String(agentNewIdMap.size).padEnd(18)}║`);
    console.log(`║  clients:   ${String(clientNewIdMap.size).padEnd(18)}║`);
    console.log(`║  vouchers:  ${String(vOk + ' OK').padEnd(18)}║`);
    console.log(`║  payments:  ${String(pOk).padEnd(18)}║`);
    console.log('╚══════════════════════════════╝');

  } catch (e) {
    await db.query('ROLLBACK');
    err(`Migration rolled back: ${e.message}`);
    console.error(e);
    process.exit(1);
  } finally {
    db.release();
    await pg.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
