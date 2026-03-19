#!/usr/bin/env node
/**
 * Incremental sync: MySQL (ci19820_voucher2) → PostgreSQL (tour_crm)
 *
 * Automatically detects the latest migrated voucher and syncs only new ones.
 *
 * Usage:
 *   node sync-from-mysql.js [--dry-run] [--from-date=2025-04-01] [--all]
 *
 * Options:
 *   --dry-run           Show what would be synced, don't write
 *   --from-date=DATE    Sync vouchers created after this date
 *   --all               Re-sync everything (safe, skips duplicates)
 *
 * Env vars (optional, defaults shown):
 *   MYSQL_HOST     localhost
 *   MYSQL_PORT     3306
 *   MYSQL_USER     root
 *   MYSQL_PASSWORD (empty)
 *   MYSQL_DB       ci19820_voucher2
 *   PG_HOST        localhost
 *   PG_PORT        5432
 *   PG_USER        postgres
 *   PG_PASSWORD    postgres (override below)
 *   PG_DB          tour_crm
 */

'use strict';

const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const MYSQL_CONFIG = {
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306'),
  user:     process.env.MYSQL_USER     || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB       || 'ci19820_voucher2',
  charset:  'utf8mb4',
};

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
  const arg = process.argv.find(a => a.startsWith('--from-date='));
  return arg ? arg.split('=')[1] : null;
})();

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }
function err(msg)  { console.error(`[ERROR] ${msg}`); }
function f(v)      { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function s(v)      { return (v || '').toString().trim(); }

function deriveTourType(row) {
  if (row.tur_flot_flag   === 1) return 'tourflot';
  if (row.individual_tour === 1) return 'individual';
  return 'group';
}

function derivePaymentStatus(row) {
  if (row.voucher_paid === 1) return 'paid';
  if (parseFloat(row.price_deposit || 0) > 0) return 'partial';
  return 'unpaid';
}

async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE SYNC'}`);

  // ── Connect ──────────────────────────────────────────────────────────────────
  log('Connecting to MySQL…');
  const my = await mysql.createConnection(MYSQL_CONFIG);

  log('Connecting to PostgreSQL…');
  const pg = new Pool(PG_CONFIG);
  await pg.query('SELECT 1');

  // ── Determine cutoff date ────────────────────────────────────────────────────
  let cutoffDate;
  if (SYNC_ALL) {
    cutoffDate = '2000-01-01';
    log('Mode: sync ALL vouchers (skips existing by voucher_number)');
  } else if (FROM_DATE) {
    cutoffDate = FROM_DATE;
    log(`Mode: sync from --from-date=${cutoffDate}`);
  } else {
    // Auto-detect: find oldest created_at from migrated vouchers that came from old system
    // Old system voucher numbers are numeric or date-based (not new format like "01500")
    // We look for the MAX created_at among vouchers that look like old-system numbers
    const res = await pg.query(`
      SELECT MAX(created_at)::date AS max_date
      FROM vouchers
      WHERE created_at IS NOT NULL
    `);
    const maxDate = res.rows[0]?.max_date;
    if (maxDate) {
      // Go back 7 days to catch any edge cases
      const d = new Date(maxDate);
      d.setDate(d.getDate() - 7);
      cutoffDate = d.toISOString().split('T')[0];
      log(`Auto-detected cutoff: ${cutoffDate} (latest PG voucher: ${maxDate}, minus 7 days)`);
    } else {
      cutoffDate = '2000-01-01';
      log('No existing vouchers found — syncing everything');
    }
  }

  // ── Read MySQL data ───────────────────────────────────────────────────────────
  log(`Reading MySQL vouchers created after ${cutoffDate}…`);

  const [mysqlUsers]    = await my.execute('SELECT * FROM users');
  const [mysqlCompanies] = await my.execute('SELECT * FROM companies');
  const [mysqlTours]    = await my.execute('SELECT * FROM company_tours');
  const [mysqlVouchers] = await my.execute(
    `SELECT * FROM vouchers WHERE created_at >= ? ORDER BY id`,
    [cutoffDate]
  );

  await my.end();

  log(`  Found ${mysqlVouchers.length} voucher(s) to sync (from ${cutoffDate})`);
  log(`  Users: ${mysqlUsers.length}, Companies: ${mysqlCompanies.length}, Tours: ${mysqlTours.length}`);

  if (mysqlVouchers.length === 0) {
    log('Nothing to sync. Database is up to date!');
    await pg.end();
    return;
  }

  if (DRY_RUN) {
    log('\n=== DRY RUN — first 10 vouchers that would be synced ===');
    for (const v of mysqlVouchers.slice(0, 10)) {
      log(`  #${String(v.voucher_number).padEnd(12)} created=${v.created_at?.toISOString().split('T')[0]}  client="${v.client_name}"  type=${deriveTourType(v)}`);
    }
    if (mysqlVouchers.length > 10) log(`  ... and ${mysqlVouchers.length - 10} more`);
    log('\nRe-run without --dry-run to actually sync.');
    await pg.end();
    return;
  }

  // ── Build lookup maps from MySQL data ────────────────────────────────────────
  const clientMap = new Map();
  const agentMap  = new Map();
  for (const v of mysqlVouchers) {
    const phone = s(v.client_phone);
    const name  = s(v.client_name);
    const mgr   = v.voucher_created_user_id;
    if (phone || name) {
      const key = `${phone}|${mgr}`;
      if (!clientMap.has(key)) clientMap.set(key, { name, phone, manager_id: mgr });
    }
    const agName = s(v.agent_name);
    if (agName) {
      const key = agName.toLowerCase();
      if (!agentMap.has(key)) agentMap.set(key, { name: agName });
    }
  }

  // ── Upsert reference data, build ID maps ─────────────────────────────────────
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Users
    const userIdMap = new Map();
    for (const u of mysqlUsers) {
      const username = s(u.email).split('@')[0] || `user_${u.id}`;
      const res = await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, commission_percentage, is_active)
         VALUES ($1, $2, $3, 'manager', $4, true)
         ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [username, u.password || '$2b$10$placeholder', s(u.name) || username, f(u.manager_percent)]
      );
      userIdMap.set(u.id, res.rows[0].id);
    }

    // Companies
    const companyIdMap = new Map();
    for (const c of mysqlCompanies) {
      const res = await client.query(
        `INSERT INTO companies (name, is_active)
         VALUES ($1, true)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [s(c.name)]
      );
      companyIdMap.set(c.id, res.rows[0].id);
    }

    // Tours
    const tourIdMap = new Map();
    for (const t of mysqlTours) {
      const tourName = s(t.tour_name);
      if (!tourName) continue;
      const res = await client.query(
        `INSERT INTO tours (name, tour_type, is_active)
         VALUES ($1, 'group', true)
         ON CONFLICT DO NOTHING RETURNING id`,
        [tourName]
      );
      let newTourId = res.rows[0]?.id;
      if (!newTourId) {
        const ex = await client.query('SELECT id FROM tours WHERE name=$1', [tourName]);
        newTourId = ex.rows[0]?.id;
      }
      if (newTourId) tourIdMap.set(t.id, newTourId);
    }

    // Agents
    const agentNewIdMap = new Map();
    for (const [key, a] of agentMap) {
      const res = await client.query(
        `INSERT INTO agents (name, commission_percentage, is_active)
         VALUES ($1, 0, true)
         ON CONFLICT DO NOTHING RETURNING id`,
        [a.name]
      );
      let newId = res.rows[0]?.id;
      if (!newId) {
        const ex = await client.query('SELECT id FROM agents WHERE LOWER(name)=LOWER($1)', [a.name]);
        newId = ex.rows[0]?.id;
      }
      if (newId) agentNewIdMap.set(key, newId);
    }

    // Clients
    const clientNewIdMap = new Map();
    for (const [key, c] of clientMap) {
      const newManagerId = userIdMap.get(c.manager_id);
      if (!newManagerId) continue;
      const res = await client.query(
        `INSERT INTO clients (name, phone, manager_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (phone, manager_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [c.name || 'Unknown', c.phone || '', newManagerId]
      );
      clientNewIdMap.set(key, res.rows[0].id);
    }

    // ── Vouchers ─────────────────────────────────────────────────────────────────
    log('Syncing vouchers…');
    let voucherNew = 0, voucherSkip = 0, voucherErr = 0;

    await client.query('ALTER TABLE vouchers DISABLE TRIGGER trigger_update_voucher_totals');

    for (const v of mysqlVouchers) {
      try {
        const tourType      = deriveTourType(v);
        const paymentStatus = derivePaymentStatus(v);

        const newManagerId = userIdMap.get(v.voucher_created_user_id);
        const newCompanyId = companyIdMap.get(v.company_id) || null;
        const newTourId    = tourIdMap.get(v.company_tour_id) || null;
        const agentKey     = s(v.agent_name).toLowerCase();
        const newAgentId   = agentKey ? (agentNewIdMap.get(agentKey) || null) : null;
        const clientKey    = `${s(v.client_phone)}|${v.voucher_created_user_id}`;
        const newClientId  = clientNewIdMap.get(clientKey) || null;

        const isIndividual = v.individual_tour === 1;
        const adultSale    = f(isIndividual ? v.price_individual : v.price_adult);
        const adultNet     = f(isIndividual ? v.price_nett_individual : v.price_nett_adult);
        const childSale    = f(v.price_child);
        const childNet     = f(v.price_nett_child);
        const transferSale = f(v.price_transfer);
        const transferNet  = f(v.price_nett_transfer);
        const otherSale    = f(v.price_other);
        const otherNet     = f(v.price_nett_other);

        const adults   = parseInt(v.client_count_adults || 0);
        const children = parseInt(v.client_count_child  || 0);
        const infants  = parseInt(v.client_count_infant || 0);

        const totalNet  = adults * adultNet + children * childNet
                        + (adults + children) * transferNet + otherNet;
        const totalSale = adults * adultSale + children * childSale
                        + (adults + children) * transferSale + otherSale;

        const paidToAgency = f(v.price_deposit);
        const cashOnTour   = totalSale - paidToAgency;
        const agentCommAmt = f(v.agent_commission);
        const agentCommPct = totalSale > 0 ? parseFloat((agentCommAmt / totalSale * 100).toFixed(2)) : 0;

        let remarks = s(v.voucher_remarks);
        if (v.voucher_important === 1) remarks = `[ВАЖНО] ${remarks}`.trim();
        if (s(v.voucher_cancellations)) remarks += ` | Отмена: ${s(v.voucher_cancellations)}`;
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

        const res = await client.query(
          `INSERT INTO vouchers (
             voucher_number, tour_type,
             client_id, manager_id, company_id, tour_id, agent_id,
             tour_date, tour_time,
             hotel_name, room_number,
             adults, children, infants,
             adult_net, child_net, infant_net, transfer_net, other_net,
             adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
             total_net, total_sale,
             paid_to_agency, cash_on_tour,
             payment_status, agent_commission_percentage,
             remarks, is_deleted, deleted_at,
             created_at, updated_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,
             $25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
           )
           ON CONFLICT (voucher_number) DO UPDATE SET
             updated_at       = EXCLUDED.updated_at,
             payment_status   = EXCLUDED.payment_status,
             paid_to_agency   = EXCLUDED.paid_to_agency,
             cash_on_tour     = EXCLUDED.cash_on_tour,
             remarks          = EXCLUDED.remarks,
             is_deleted       = EXCLUDED.is_deleted,
             deleted_at       = EXCLUDED.deleted_at
           RETURNING (xmax = 0) AS inserted`,
          [
            s(v.voucher_number), tourType,
            newClientId, newManagerId, newCompanyId, newTourId, newAgentId,
            tourDate, tourTime,
            s(v.hotel_name) || null, s(v.hotel_room_number) || null,
            adults, children, infants,
            adultNet, childNet, 0, transferNet, otherNet,
            adultSale, childSale, 0, transferSale, otherSale,
            totalNet, totalSale,
            paidToAgency, cashOnTour,
            paymentStatus, agentCommPct,
            remarks, v.deleted_at !== null, v.deleted_at || null,
            v.created_at || new Date(), v.updated_at || new Date(),
          ]
        );

        if (res.rows[0]?.inserted) voucherNew++; else voucherSkip++;

      } catch (e) {
        err(`Voucher ${v.voucher_number}: ${e.message}`);
        voucherErr++;
      }
    }

    await client.query('ALTER TABLE vouchers ENABLE TRIGGER trigger_update_voucher_totals');

    // ── Payments for new vouchers ─────────────────────────────────────────────
    // (Only insert payment if it doesn't already exist for this voucher)
    log('Syncing payments…');
    let paymentNew = 0;
    for (const v of mysqlVouchers) {
      const deposit = f(v.price_deposit);
      if (deposit <= 0 || v.deleted_at) continue;

      const pgV = await client.query(
        'SELECT id FROM vouchers WHERE voucher_number=$1', [s(v.voucher_number)]
      );
      if (!pgV.rows.length) continue;
      const pgVoucherId = pgV.rows[0].id;

      const existing = await client.query(
        `SELECT id FROM payments WHERE voucher_id=$1 AND notes LIKE '%price_deposit%'`,
        [pgVoucherId]
      );
      if (existing.rows.length > 0) continue; // already synced

      const newManagerId = userIdMap.get(v.voucher_created_user_id);
      await client.query(
        `INSERT INTO payments (voucher_id, payment_date, amount, payment_method, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          pgVoucherId,
          v.created_at || new Date(),
          deposit,
          s(v.voucher_money).toUpperCase() || 'cash',
          `Мигрировано из price_deposit`,
          newManagerId || null,
        ]
      );
      paymentNew++;
    }

    await client.query('COMMIT');

    log('');
    log('════════════════════════════════');
    log('       SYNC COMPLETE');
    log('════════════════════════════════');
    log(`  Vouchers new:     ${voucherNew}`);
    log(`  Vouchers updated: ${voucherSkip}`);
    log(`  Vouchers errors:  ${voucherErr}`);
    log(`  Payments new:     ${paymentNew}`);
    log(`  Cutoff date used: ${cutoffDate}`);

  } catch (e) {
    await client.query('ROLLBACK');
    err(`Sync rolled back: ${e.message}`);
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pg.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
