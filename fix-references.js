#!/usr/bin/env node
/**
 * fix-references.js
 * 1. Imports missing companies from ci19820_voucher2.sql into PG
 * 2. Fixes voucher.company_id (old MySQL id → PG id)
 * 3. Fixes voucher.manager_id (old MySQL user id → PG user id)
 * 4. Imports company_tours as tours (optional, pass --tours)
 *
 * Usage:
 *   node fix-references.js [--dry-run] [--tours]
 */

'use strict';

const fs   = require('fs');
const { Pool } = require('pg');

const PG_CONFIG = {
  host:     'localhost',
  port:     5432,
  user:     'postgres',
  password: process.env.PG_PASSWORD || '',
  database: 'tour_crm',
};

const DRY_RUN   = process.argv.includes('--dry-run');
const DO_TOURS  = process.argv.includes('--tours');
const SQL_FILE  = 'C:\\Users\\1\\Downloads\\ci19820_voucher2.sql';

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }

// ── Simple SQL parser (same as sync-from-sql-file.js) ──────────────────────
function parseRow(src, pos) {
  if (src[pos] !== '(') return null;
  pos++;
  const values = [];
  while (pos < src.length) {
    while (pos < src.length && ' \n\r\t'.includes(src[pos])) pos++;
    if (src[pos] === ')') { pos++; break; }
    if (src[pos] === ',') { pos++; continue; }
    if (src.startsWith('NULL', pos)) {
      values.push(null); pos += 4;
    } else if (src[pos] === "'") {
      pos++;
      let str = '';
      while (pos < src.length) {
        if (src[pos] === '\\' && pos + 1 < src.length) {
          const n = src[pos+1];
          str += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n;
          pos += 2;
        } else if (src[pos] === "'" && src[pos+1] === "'") {
          str += "'"; pos += 2;
        } else if (src[pos] === "'") {
          pos++; break;
        } else {
          str += src[pos++];
        }
      }
      values.push(str);
    } else {
      let num = '';
      while (pos < src.length && !',' .includes(src[pos]) && src[pos] !== ')' && src[pos] !== ' ') {
        num += src[pos++];
      }
      values.push(num === 'NULL' ? null : num);
    }
  }
  return { values, endPos: pos };
}

function parseTable(raw, tableName) {
  const rows = [];
  let columns = null;
  const re = new RegExp(`INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES\\s*`, 'g');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const cols = m[1].split(',').map(c => c.trim().replace(/`/g, ''));
    if (!columns) columns = cols;
    let pos = m.index + m[0].length;
    while (pos < raw.length) {
      while (pos < raw.length && ' \n\r\t'.includes(raw[pos])) pos++;
      if (raw[pos] !== '(') break;
      const result = parseRow(raw, pos);
      if (!result) break;
      pos = result.endPos;
      const obj = {};
      cols.forEach((c, i) => { obj[c] = result.values[i] ?? null; });
      rows.push(obj);
      while (pos < raw.length && (raw[pos] === ',' || raw[pos] === ' ' || raw[pos] === '\n' || raw[pos] === '\r')) {
        if (raw[pos] === ';') break;
        pos++;
      }
    }
  }
  return rows;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  const pg = new Pool(PG_CONFIG);
  await pg.query('SELECT 1');
  log('PostgreSQL connected');

  log(`Reading SQL file: ${SQL_FILE}`);
  const raw = fs.readFileSync(SQL_FILE, 'utf8');

  // ── 1. Parse MySQL tables ────────────────────────────────────────────────
  const mysqlCompanies = parseTable(raw, 'companies');
  const mysqlUsers     = parseTable(raw, 'users');
  const mysqlTours     = DO_TOURS ? parseTable(raw, 'company_tours') : [];
  log(`MySQL companies: ${mysqlCompanies.length}, users: ${mysqlUsers.length}, company_tours: ${mysqlTours.length}`);

  // ── 2. Load current PG data ──────────────────────────────────────────────
  const [pgCompR, pgUserR] = await Promise.all([
    pg.query('SELECT id, name FROM companies ORDER BY id'),
    pg.query('SELECT id, username, manager_number FROM users'),
  ]);

  const pgCompaniesByName = new Map(pgCompR.rows.map(r => [r.name.toLowerCase().trim(), r.id]));
  const pgUsersByUsername = new Map(pgUserR.rows.map(r => [r.username?.toLowerCase(), r.id]));
  const pgUsersByManagerNum = new Map(pgUserR.rows.map(r => [String(r.manager_number), r.id]));

  // ── 3. Build company mapping: MySQL id → PG id ──────────────────────────
  log('\n── COMPANIES ──');
  const companyMap = new Map(); // mysql_id → pg_id

  for (const mc of mysqlCompanies) {
    const mysqlId = parseInt(mc.id);
    // Try offset +135 first (known migration offset)
    const pgIdByOffset = mysqlId + 135;
    const pgIdByOffset2 = mysqlId + 135;

    // Try to find by normalized name
    const nameFull = (mc.name || '').trim();
    // Remove abbreviation in parentheses for matching: "BTC (B)" → "BTC"
    const nameNorm = nameFull.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase().trim();

    let pgId = null;

    // Check if offset matches
    const byOffset = pgCompR.rows.find(r => r.id === pgIdByOffset);
    if (byOffset) {
      pgId = pgIdByOffset;
    } else {
      // Try name match
      pgId = pgCompaniesByName.get(nameNorm) || pgCompaniesByName.get(nameFull.toLowerCase()) || null;
    }

    if (pgId) {
      companyMap.set(mysqlId, pgId);
      log(`  MySQL ${mysqlId} "${nameFull}" → PG ${pgId}`);
    } else {
      // Need to create
      log(`  MySQL ${mysqlId} "${nameFull}" → NOT FOUND, will create`);
      if (!DRY_RUN) {
        const ins = await pg.query(
          'INSERT INTO companies (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) RETURNING id',
          [nameFull]
        );
        const newId = ins.rows[0].id;
        companyMap.set(mysqlId, newId);
        pgCompaniesByName.set(nameFull.toLowerCase(), newId);
        log(`    → Created PG id=${newId}`);
      }
    }
  }

  // ── 4. Build manager mapping: MySQL user id → PG user id ────────────────
  log('\n── MANAGERS ──');
  const managerMap = new Map(); // mysql_id → pg_id

  for (const mu of mysqlUsers) {
    const mysqlId = parseInt(mu.id);
    const email   = (mu.email || '').toLowerCase().trim();
    const username = email.split('@')[0].toLowerCase();

    // Try by manager_number first
    let pgId = pgUsersByManagerNum.get(String(mysqlId)) || null;

    // Try by username
    if (!pgId) {
      pgId = pgUsersByUsername.get(username) || pgUsersByUsername.get(email) || null;
    }

    if (pgId) {
      managerMap.set(mysqlId, pgId);
      log(`  MySQL user ${mysqlId} "${mu.name}" → PG user ${pgId}`);

      // Update manager_number if it's '00'
      const pgUser = pgUserR.rows.find(r => r.id === pgId);
      if (pgUser && pgUser.manager_number === '00' && !DRY_RUN) {
        await pg.query('UPDATE users SET manager_number=$1 WHERE id=$2', [String(mysqlId), pgId]);
        log(`    → Updated manager_number to ${mysqlId}`);
      }
    } else {
      warn(`  MySQL user ${mysqlId} "${mu.name}" (${mu.email}) → NOT FOUND in PG`);
    }
  }

  // ── 5. Fix voucher company_id references ────────────────────────────────
  log('\n── FIXING VOUCHER COMPANY_IDs ──');
  let compFixed = 0, compNull = 0;

  for (const [mysqlId, pgId] of companyMap) {
    if (!DRY_RUN) {
      const res = await pg.query(
        'UPDATE vouchers SET company_id=$1 WHERE company_id=$2 AND created_at > \'2025-04-02\'',
        [pgId, mysqlId]
      );
      if (res.rowCount > 0) {
        log(`  MySQL company ${mysqlId} → PG ${pgId}: updated ${res.rowCount} vouchers`);
        compFixed += res.rowCount;
      }
    } else {
      const res = await pg.query(
        'SELECT COUNT(*) FROM vouchers WHERE company_id=$1 AND created_at > \'2025-04-02\'',
        [mysqlId]
      );
      const cnt = parseInt(res.rows[0].count);
      if (cnt > 0) {
        log(`  [DRY] MySQL company ${mysqlId} → PG ${pgId}: would update ${cnt} vouchers`);
        compFixed += cnt;
      }
    }
  }

  // ── 6. Fix voucher manager_id references ────────────────────────────────
  log('\n── FIXING VOUCHER MANAGER_IDs ──');
  let mgrFixed = 0;

  for (const [mysqlId, pgId] of managerMap) {
    if (!DRY_RUN) {
      const res = await pg.query(
        'UPDATE vouchers SET manager_id=$1 WHERE manager_id=$2 AND created_at > \'2025-04-02\'',
        [pgId, mysqlId]
      );
      if (res.rowCount > 0) {
        log(`  MySQL user ${mysqlId} → PG ${pgId}: updated ${res.rowCount} vouchers`);
        mgrFixed += res.rowCount;
      }
    } else {
      const res = await pg.query(
        'SELECT COUNT(*) FROM vouchers WHERE manager_id=$1 AND created_at > \'2025-04-02\'',
        [mysqlId]
      );
      const cnt = parseInt(res.rows[0].count);
      if (cnt > 0) {
        log(`  [DRY] MySQL user ${mysqlId} → PG ${pgId}: would update ${cnt} vouchers`);
        mgrFixed += cnt;
      }
    }
  }

  // ── 7. Fix NULL company_ids by re-reading vouchers SQL ──────────────────
  log('\n── FIXING NULL COMPANY_IDs FROM SQL FILE ──');
  const voucherRows = parseTable(
    fs.readFileSync('C:\\Users\\1\\Downloads\\vouchers_only.sql', 'utf8'),
    'vouchers'
  );
  log(`Re-reading ${voucherRows.length} vouchers from SQL file`);

  let nullFixed = 0, nullSkipped = 0;
  for (const row of voucherRows) {
    if (!row.company_id) continue;
    const mysqlCompId = parseInt(row.company_id);
    const pgCompId    = companyMap.get(mysqlCompId);
    if (!pgCompId) continue;

    const voucherNum = (row.voucher_number || '').trim();
    if (!voucherNum) continue;

    if (!DRY_RUN) {
      const res = await pg.query(
        'UPDATE vouchers SET company_id=$1 WHERE voucher_number=$2 AND company_id IS NULL',
        [pgCompId, voucherNum]
      );
      if (res.rowCount > 0) nullFixed++;
      else nullSkipped++;
    } else {
      nullFixed++;
    }
  }
  log(`NULL company_ids fixed: ${nullFixed}, skipped (already set): ${nullSkipped}`);

  // Also fix manager_ids that are NULL by re-reading vouchers SQL
  log('\n── FIXING NULL MANAGER_IDs FROM SQL FILE ──');
  let mgrNullFixed = 0;
  for (const row of voucherRows) {
    if (!row.voucher_created_user_id) continue;
    const mysqlUserId = parseInt(row.voucher_created_user_id);
    const pgUserId    = managerMap.get(mysqlUserId);
    if (!pgUserId) continue;

    const voucherNum = (row.voucher_number || '').trim();
    if (!voucherNum) continue;

    if (!DRY_RUN) {
      const res = await pg.query(
        'UPDATE vouchers SET manager_id=$1 WHERE voucher_number=$2 AND manager_id IS NULL',
        [pgUserId, voucherNum]
      );
      if (res.rowCount > 0) mgrNullFixed++;
    } else {
      mgrNullFixed++;
    }
  }
  log(`NULL manager_ids fixed: ${mgrNullFixed}`);

  // ── 8. Import company_tours as tours ────────────────────────────────────
  if (DO_TOURS) {
    log('\n── IMPORTING COMPANY_TOURS AS TOURS ──');
    mysqlTours.length || log('No company_tours found in SQL file — export them separately if needed');
    const existingTours = await pg.query('SELECT name FROM tours');
    const existingTourNames = new Set(existingTours.rows.map(r => r.name.toLowerCase().trim()));
    let toursAdded = 0;

    // Group by tour_name, deduplicate
    const uniqueTourNames = [...new Set(mysqlTours.map(t => t.tour_name).filter(Boolean))];
    log(`Unique tour names from MySQL: ${uniqueTourNames.length}`);

    for (const tourName of uniqueTourNames) {
      if (existingTourNames.has(tourName.toLowerCase().trim())) {
        continue; // already exists
      }
      if (!DRY_RUN) {
        await pg.query(
          'INSERT INTO tours (name, created_at, updated_at) VALUES ($1, NOW(), NOW()) ON CONFLICT DO NOTHING',
          [tourName]
        );
        toursAdded++;
      } else {
        log(`  [DRY] Would add tour: "${tourName}"`);
        toursAdded++;
      }
    }
    log(`Tours added: ${toursAdded}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  log('\n── SUMMARY ──');
  log(`Company mappings built: ${companyMap.size}`);
  log(`Manager mappings built: ${managerMap.size}`);
  log(`Voucher company_ids fixed: ${compFixed}`);
  log(`Voucher manager_ids fixed: ${mgrFixed}`);
  log('Done.');

  await pg.end();
}

main().catch(e => { console.error(e); process.exit(1); });
