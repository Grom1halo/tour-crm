#!/usr/bin/env node
/**
 * Migration script: MySQL (ci19820_voucher2) → PostgreSQL (tour_crm)
 *
 * Prerequisites:
 *   npm install mysql2 pg
 *
 * Usage:
 *   node migrate-from-mysql.js [--dry-run]
 *
 * --dry-run  Read from MySQL and print stats only, do NOT write to PostgreSQL.
 */

'use strict';

const mysql = require('mysql2/promise');
const { Pool } = require('pg');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
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
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB       || 'tour_crm',
};

const DRY_RUN = process.argv.includes('--dry-run');

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }
function err(msg)  { console.error(`[ERROR] ${msg}`); }

/**
 * Derive tour_type from old flags:
 *   tur_flot_flag = 1  → 'tourflot'
 *   individual_tour = 1 → 'individual'
 *   otherwise           → 'group'
 */
function deriveTourType(row) {
  if (row.tur_flot_flag  === 1) return 'tourflot';
  if (row.individual_tour === 1) return 'individual';
  return 'group';
}

/**
 * Derive payment_status:
 *   voucher_paid = 1            → 'paid'
 *   price_deposit > 0           → 'partial'
 *   otherwise                   → 'unpaid'
 */
function derivePaymentStatus(row) {
  if (row.voucher_paid === 1) return 'paid';
  const deposit = parseFloat(row.price_deposit || 0);
  if (deposit > 0) return 'partial';
  return 'unpaid';
}

/** Safely convert to float, default 0 */
function f(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

/** Null-safe string trim */
function s(v) { return (v || '').toString().trim(); }

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE MIGRATION'}`);

  // ── 1. Connect ──────────────────────────────────────────────────────────────
  log('Connecting to MySQL…');
  const my = await mysql.createConnection(MYSQL_CONFIG);

  let pg = null;
  if (!DRY_RUN) {
    log('Connecting to PostgreSQL…');
    pg = new Pool(PG_CONFIG);
    await pg.query('SELECT 1'); // smoke-test
  }

  // ── 2. Read all source tables ───────────────────────────────────────────────
  log('Reading MySQL data…');

  const [mysqlUsers]    = await my.execute('SELECT * FROM users WHERE deleted_at IS NULL');
  const [mysqlVouchers] = await my.execute(
    'SELECT * FROM vouchers ORDER BY id'
  );
  const [mysqlCompanies] = await my.execute(
    'SELECT * FROM companies WHERE deleted_at IS NULL ORDER BY id'
  );
  const [mysqlTours] = await my.execute(
    'SELECT * FROM company_tours WHERE deleted_at IS NULL ORDER BY id'
  );

  log(`  users:         ${mysqlUsers.length}`);
  log(`  vouchers:      ${mysqlVouchers.length} (incl. soft-deleted)`);
  log(`  companies:     ${mysqlCompanies.length}`);
  log(`  company_tours: ${mysqlTours.length}`);

  await my.end();

  // ── 3. Build lookup maps ────────────────────────────────────────────────────

  // 3a. Unique clients: key = "phone|manager_id" when phone present,
  //     "name|manager_id" when phone is empty (avoids merging all no-phone clients)
  const clientMap = new Map(); // key → {name, phone, manager_id}
  for (const v of mysqlVouchers) {
    const rawPhone = s(v.client_phone);
    const phone = (rawPhone && rawPhone !== '-') ? rawPhone : null; // null for empty/dash
    const name  = s(v.client_name);
    const mgr   = v.voucher_created_user_id;
    if (!phone && !name) continue; // skip empty
    // When no phone, use name as dedup key so each unique name gets its own client record
    const key = phone ? `${phone}|${mgr}` : `__name__${name.toLowerCase()}|${mgr}`;
    if (!clientMap.has(key)) {
      clientMap.set(key, { name, phone, manager_id: mgr });
    }
  }

  // 3b. Unique agents: key = trimmed agent_name (lower-case)
  const agentMap = new Map(); // normalised_name → {name, commission_percentage}
  for (const v of mysqlVouchers) {
    const name = s(v.agent_name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!agentMap.has(key)) {
      agentMap.set(key, { name, commission_percentage: 0 });
    }
  }

  log(`  unique clients (from vouchers): ${clientMap.size}`);
  log(`  unique agents  (from vouchers): ${agentMap.size}`);

  // ── 4. DRY-RUN summary and exit ────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n=== DRY-RUN FIELD MAPPING PREVIEW ===');
    console.log('\n--- OLD users sample ---');
    for (const u of mysqlUsers.slice(0, 3)) {
      console.log(`  id=${u.id}  name="${u.name}"  email="${u.email}"  percent=${u.manager_percent}`);
    }
    console.log('\n--- OLD companies sample ---');
    for (const c of mysqlCompanies.slice(0, 3)) {
      console.log(`  id=${c.id}  name="${c.name}"`);
    }
    console.log('\n--- OLD company_tours sample ---');
    for (const t of mysqlTours.slice(0, 3)) {
      console.log(`  id=${t.id}  company_id=${t.company_id}  tour_name="${t.tour_name}"  nett_adult=${t.price_nett_adult}`);
    }
    console.log('\n--- Unique clients (first 5) ---');
    let i = 0;
    for (const [k, v] of clientMap) {
      if (i++ >= 5) break;
      console.log(`  key="${k}"  name="${v.name}"  phone="${v.phone}"  manager=${v.manager_id}`);
    }
    console.log('\n--- Unique agents ---');
    for (const [k, v] of agentMap) {
      console.log(`  key="${k}"  name="${v.name}"`);
    }
    console.log('\n--- Voucher sample (first 3) ---');
    for (const v of mysqlVouchers.slice(0, 3)) {
      console.log(`  #${v.voucher_number}  client="${v.client_name}"  agent="${v.agent_name}"  type=${deriveTourType(v)}  deposit=${v.price_deposit}  paid=${v.voucher_paid}`);
    }
    console.log('\nDry-run complete. Re-run without --dry-run to migrate.');
    return;
  }

  // ── 5. Live migration ───────────────────────────────────────────────────────
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // ── 5a. Migrate users ──────────────────────────────────────────────────
    log('Migrating users…');
    const userIdMap = new Map(); // old_id → new_id

    for (const u of mysqlUsers) {
      // Derive a unique username from email or name
      const username = s(u.email).split('@')[0] || s(u.name).toLowerCase().replace(/\s+/g, '_') || `user_${u.id}`;
      const fullName = s(u.name) || username;

      const res = await client.query(
        `INSERT INTO users (username, password_hash, full_name, role, commission_percentage, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (username) DO UPDATE
           SET full_name            = EXCLUDED.full_name,
               commission_percentage = EXCLUDED.commission_percentage
         RETURNING id`,
        [
          username,
          u.password || '$2b$10$placeholder_hash_change_me_on_login',
          fullName,
          'manager',                      // all old users are managers
          f(u.manager_percent),
          true,
        ]
      );
      userIdMap.set(u.id, res.rows[0].id);
    }
    log(`  users migrated: ${userIdMap.size}`);

    // ── 5b. Migrate companies ──────────────────────────────────────────────
    log('Migrating companies…');
    const companyIdMap = new Map(); // old_id → new_id

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
    log(`  companies migrated: ${companyIdMap.size}`);

    // ── 5c. Migrate tours (company_tours → tours) ──────────────────────────
    log('Migrating tours…');
    const tourIdMap = new Map(); // old company_tour_id → new tour_id

    for (const t of mysqlTours) {
      const tourName = s(t.tour_name);
      if (!tourName) continue;

      const res = await client.query(
        `INSERT INTO tours (name, tour_type, is_active)
         VALUES ($1, 'group', true)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [tourName]
      );

      let newTourId;
      if (res.rows.length > 0) {
        newTourId = res.rows[0].id;
      } else {
        // Already exists – fetch id
        const existing = await client.query(
          'SELECT id FROM tours WHERE name = $1', [tourName]
        );
        newTourId = existing.rows[0].id;
      }
      tourIdMap.set(t.id, newTourId);

      // Insert tour_price using nett prices from company_tours
      const companyNewId = companyIdMap.get(t.company_id);
      if (companyNewId) {
        await client.query(
          `INSERT INTO tour_prices
             (tour_id, company_id, valid_from, valid_to,
              adult_net, child_net, infant_net, transfer_net, other_net,
              adult_sale, child_sale, infant_sale, transfer_sale, other_sale)
           VALUES ($1,$2,'2020-01-01','2099-12-31', $3,$4,0,0,0, $3,$4,0,0,0)
           ON CONFLICT DO NOTHING`,
          [newTourId, companyNewId, f(t.price_nett_adult), f(t.price_nett_child)]
        );
      }
    }
    log(`  tours migrated: ${tourIdMap.size}`);

    // ── 5d. Migrate agents ─────────────────────────────────────────────────
    log('Migrating agents…');
    const agentNewIdMap = new Map(); // normalised_name → new_id

    for (const [key, a] of agentMap) {
      const res = await client.query(
        `INSERT INTO agents (name, commission_percentage, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [a.name, a.commission_percentage]
      );
      let newId;
      if (res.rows.length > 0) {
        newId = res.rows[0].id;
      } else {
        const existing = await client.query(
          'SELECT id FROM agents WHERE LOWER(name) = LOWER($1)', [a.name]
        );
        newId = existing.rows[0]?.id;
      }
      if (newId) agentNewIdMap.set(key, newId);
    }
    log(`  agents migrated: ${agentNewIdMap.size}`);

    // ── 5e. Migrate clients ────────────────────────────────────────────────
    log('Migrating clients…');
    const clientNewIdMap = new Map(); // "phone|manager_old_id" → new client_id

    for (const [key, c] of clientMap) {
      const newManagerId = userIdMap.get(c.manager_id);
      if (!newManagerId) {
        warn(`Client "${c.name}" skipped: manager_id=${c.manager_id} not found in new users`);
        continue;
      }

      const res = await client.query(
        `INSERT INTO clients (name, phone, manager_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (phone, manager_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [c.name || 'Unknown', c.phone || '', newManagerId]
      );
      clientNewIdMap.set(key, res.rows[0].id);
    }
    log(`  clients migrated: ${clientNewIdMap.size}`);

    // ── 5f. Migrate vouchers ───────────────────────────────────────────────
    log('Migrating vouchers…');
    let voucherOk = 0, voucherSkip = 0;

    // Temporarily disable voucher triggers to avoid recalculation conflicts
    // (we'll set computed fields explicitly via UPDATE after insert)
    await client.query('ALTER TABLE vouchers DISABLE TRIGGER trigger_update_voucher_totals');

    const voucherIdMap = new Map(); // old_id → new_id

    for (const v of mysqlVouchers) {
      try {
        const tourType     = deriveTourType(v);
        const paymentStatus = derivePaymentStatus(v);

        // Resolve FKs
        const newManagerId = userIdMap.get(v.voucher_created_user_id);
        const newCompanyId = companyIdMap.get(v.company_id) || null;
        const newTourId    = tourIdMap.get(v.company_tour_id) || null;

        const agentKey     = s(v.agent_name).toLowerCase();
        const newAgentId   = agentKey ? (agentNewIdMap.get(agentKey) || null) : null;

        const phone   = s(v.client_phone);
        const mgr     = v.voucher_created_user_id;
        const clientKey = `${phone}|${mgr}`;
        const newClientId = clientNewIdMap.get(clientKey) || null;

        // Price mapping
        // Individual tour uses price_individual / price_nett_individual for adults
        const isIndividual = v.individual_tour === 1;
        const adultSale    = f(isIndividual ? v.price_individual  : v.price_adult);
        const adultNet     = f(isIndividual ? v.price_nett_individual : v.price_nett_adult);
        const childSale    = f(v.price_child);
        const childNet     = f(v.price_nett_child);
        const transferSale = f(v.price_transfer);
        const transferNet  = f(v.price_nett_transfer);
        // price_other is sale; price_nett_other is net
        const otherSale    = f(v.price_other);
        const otherNet     = f(v.price_nett_other);

        const adults   = parseInt(v.client_count_adults  || 0);
        const children = parseInt(v.client_count_child   || 0);
        const infants  = parseInt(v.client_count_infant  || 0);

        // Total calculations (mirror schema trigger logic)
        const totalNet  = adults * adultNet + children * childNet + infants * 0
                        + (adults + children) * transferNet + otherNet;
        const totalSale = adults * adultSale + children * childSale + infants * 0
                        + (adults + children) * transferSale + otherSale;

        // price_deposit = amount already paid to agency
        const paidToAgency = f(v.price_deposit);
        const cashOnTour   = totalSale - paidToAgency;

        // Agent commission percentage: compute from amount if possible
        const agentCommAmt = f(v.agent_commission);
        const agentCommPct = totalSale > 0 ? parseFloat((agentCommAmt / totalSale * 100).toFixed(2)) : 0;

        // Remarks: include important flag and cancellation info
        let remarks = s(v.voucher_remarks);
        if (v.voucher_important === 1) remarks = `[ВАЖНО] ${remarks}`.trim();
        if (s(v.voucher_cancellations)) remarks += ` | Отмена: ${s(v.voucher_cancellations)}`;
        remarks = remarks.trim() || null;

        // tour_date / tour_time from client_datetime_trip
        let tourDate = null, tourTime = null;
        if (v.client_datetime_trip) {
          const dt = new Date(v.client_datetime_trip);
          if (!isNaN(dt)) {
            tourDate = dt.toISOString().split('T')[0];
            tourTime = dt.toTimeString().split(' ')[0];
          }
        }
        if (!tourDate) {
          warn(`Voucher ${v.voucher_number}: no tour_date, using created_at`);
          tourDate = v.created_at
            ? new Date(v.created_at).toISOString().split('T')[0]
            : '2020-01-01';
        }

        const isDeleted  = v.deleted_at !== null;
        const deletedAt  = isDeleted ? v.deleted_at : null;

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
             payment_status,
             agent_commission_percentage,
             remarks,
             is_deleted, deleted_at,
             created_at, updated_at
           ) VALUES (
             $1,$2, $3,$4,$5,$6,$7, $8,$9, $10,$11,
             $12,$13,$14,
             $15,$16,$17,$18,$19,
             $20,$21,$22,$23,$24,
             $25,$26, $27,$28, $29, $30, $31, $32,$33, $34,$35
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
            totalNet, totalSale,
            paidToAgency, cashOnTour,
            paymentStatus,
            agentCommPct,
            remarks,
            isDeleted, deletedAt,
            v.created_at || new Date(),
            v.updated_at || new Date(),
          ]
        );

        if (res.rows.length > 0) {
          voucherIdMap.set(v.id, res.rows[0].id);
          voucherOk++;
        } else {
          warn(`Voucher ${v.voucher_number} skipped (conflict / already exists)`);
          voucherSkip++;
        }
      } catch (e) {
        err(`Voucher ${v.voucher_number} failed: ${e.message}`);
        voucherSkip++;
      }
    }

    // Re-enable trigger
    await client.query('ALTER TABLE vouchers ENABLE TRIGGER trigger_update_voucher_totals');

    log(`  vouchers migrated: ${voucherOk}, skipped: ${voucherSkip}`);

    // ── 5g. Migrate payments (from price_deposit) ──────────────────────────
    log('Migrating payments from price_deposit…');
    let paymentOk = 0;

    for (const v of mysqlVouchers) {
      const deposit = f(v.price_deposit);
      if (deposit <= 0) continue;
      if (v.deleted_at) continue; // skip deleted

      const newVoucherId = voucherIdMap.get(v.id);
      if (!newVoucherId) continue;

      const newManagerId = userIdMap.get(v.voucher_created_user_id);

      // Determine payment method from voucher_money (currency hint)
      const currency = s(v.voucher_money).toUpperCase();
      const method   = currency || 'cash';

      await client.query(
        `INSERT INTO payments (voucher_id, payment_date, amount, payment_method, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newVoucherId,
          v.created_at || new Date(),
          deposit,
          method,
          `Мигрировано из price_deposit (${currency})`,
          newManagerId || null,
        ]
      );
      paymentOk++;
    }
    log(`  payments created: ${paymentOk}`);

    // ── 5h. Commit ─────────────────────────────────────────────────────────
    await client.query('COMMIT');
    log('');
    log('=== MIGRATION COMPLETE ===');
    log(`  users:    ${userIdMap.size}`);
    log(`  companies: ${companyIdMap.size}`);
    log(`  tours:     ${tourIdMap.size}`);
    log(`  agents:    ${agentNewIdMap.size}`);
    log(`  clients:   ${clientNewIdMap.size}`);
    log(`  vouchers:  ${voucherOk} OK, ${voucherSkip} skipped`);
    log(`  payments:  ${paymentOk}`);

  } catch (e) {
    await client.query('ROLLBACK');
    err(`Migration rolled back: ${e.message}`);
    console.error(e);
    process.exit(1);
  } finally {
    client.release();
    await pg.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
