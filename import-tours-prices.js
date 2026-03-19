#!/usr/bin/env node
/**
 * import-tours-prices.js
 * Imports company_tours from ci19820_voucher2.sql into PG:
 *   - tours (unique by name)
 *   - tour_prices (per company + tour, using adult_net / child_net)
 *
 * Usage: node import-tours-prices.js [--dry-run]
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

const DRY_RUN  = process.argv.includes('--dry-run');
const SQL_FILE = 'C:/Users/1/Downloads/ci19820_voucher2.sql';

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }

// ── SQL parser ──────────────────────────────────────────────────────────────
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
      while (pos < src.length && src[pos] !== ',' && src[pos] !== ')' && src[pos] !== ' ') {
        num += src[pos++];
      }
      values.push(num === 'NULL' ? null : num);
    }
  }
  return { values, endPos: pos };
}

function parseTable(raw, tableName) {
  const rows = [];
  // Match both backtick and plain table names
  const re = new RegExp('INSERT INTO [`]?' + tableName + '[`]?\\s*\\(([^)]+)\\)\\s*VALUES\\s*', 'g');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const cols = m[1].split(',').map(c => c.trim().replace(/`/g, ''));
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
      // Skip comma or semicolon between rows
      while (pos < raw.length && (raw[pos] === ' ' || raw[pos] === '\n' || raw[pos] === '\r')) pos++;
      if (raw[pos] === ',') pos++;
      else break; // semicolon or end
    }
  }
  return rows;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  const pg = new Pool(PG_CONFIG);
  await pg.query('SELECT 1');
  log('PostgreSQL connected');

  log(`Reading SQL file: ${SQL_FILE}`);
  const raw = fs.readFileSync(SQL_FILE, 'utf8');

  // Parse company_tours
  const companyTours = parseTable(raw, 'company_tours');
  log(`Parsed ${companyTours.length} company_tours rows`);
  if (companyTours.length === 0) {
    warn('No rows parsed — check regex / file content');
    await pg.end();
    return;
  }

  // Show sample
  log('Sample: ' + JSON.stringify(companyTours[0]));

  // ── 1. Build company mapping (MySQL id → PG id) ─────────────────────────
  // Load PG companies
  const pgCompR = await pg.query('SELECT id, name FROM companies ORDER BY id');
  // Also parse MySQL companies to build the map
  const mysqlCompanies = parseTable(raw, 'companies');
  log(`MySQL companies parsed: ${mysqlCompanies.length}`);

  const pgCompaniesByName = new Map(pgCompR.rows.map(r => [r.name.toLowerCase().trim(), r.id]));

  const companyMap = new Map(); // mysql_id → pg_id

  for (const mc of mysqlCompanies) {
    const mysqlId = parseInt(mc.id);
    const pgIdByOffset = mysqlId + 135;
    const nameFull = (mc.name || '').trim();
    const nameNorm = nameFull.replace(/\s*\([^)]+\)\s*$/, '').toLowerCase().trim();

    let pgId = null;
    const byOffset = pgCompR.rows.find(r => r.id === pgIdByOffset);
    if (byOffset) {
      pgId = pgIdByOffset;
    } else {
      pgId = pgCompaniesByName.get(nameNorm) || pgCompaniesByName.get(nameFull.toLowerCase()) || null;
    }

    if (pgId) {
      companyMap.set(mysqlId, pgId);
    } else {
      warn(`  MySQL company ${mysqlId} "${nameFull}" → NOT FOUND in PG`);
    }
  }
  log(`Company mappings built: ${companyMap.size}`);

  // ── 2. Get or create tours by name ─────────────────────────────────────
  const existingToursR = await pg.query('SELECT id, name FROM tours');
  const tourByName = new Map(existingToursR.rows.map(r => [r.name.toLowerCase().trim(), r.id]));
  log(`Existing tours in PG: ${tourByName.size}`);

  // Collect unique tour names
  const uniqueTourNames = [...new Set(companyTours.map(ct => (ct.tour_name || '').trim()).filter(Boolean))];
  log(`Unique tour names in MySQL: ${uniqueTourNames.length}`);

  let toursAdded = 0;
  for (const name of uniqueTourNames) {
    const key = name.toLowerCase().trim();
    if (!tourByName.has(key)) {
      if (!DRY_RUN) {
        const r = await pg.query(
          'INSERT INTO tours (name, tour_type, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW()) RETURNING id',
          [name, 'group']
        );
        tourByName.set(key, r.rows[0].id);
        toursAdded++;
      } else {
        log(`  [DRY] Would add tour: "${name}"`);
        toursAdded++;
      }
    }
  }
  log(`Tours added: ${toursAdded}`);

  // ── 3. Import tour_prices ───────────────────────────────────────────────
  // First, clear existing tour_prices that came from this import
  // (We'll do upsert by tour_id + company_id — no duplicate entries)
  let pricesAdded = 0, pricesUpdated = 0, pricesSkipped = 0;

  // Load existing tour_prices
  const existingPricesR = await pg.query('SELECT id, tour_id, company_id FROM tour_prices');
  // Map: "tourId_companyId" → price row id
  const existingPricesMap = new Map(
    existingPricesR.rows.map(r => [`${r.tour_id}_${r.company_id}`, r.id])
  );

  for (const ct of companyTours) {
    if (ct.deleted_at) continue; // skip deleted

    const tourName = (ct.tour_name || '').trim();
    if (!tourName) continue;

    const mysqlCompId = parseInt(ct.company_id);
    const pgCompId = companyMap.get(mysqlCompId);
    if (!pgCompId) {
      warn(`  Skipping tour "${tourName}" — company MySQL ${mysqlCompId} not mapped`);
      pricesSkipped++;
      continue;
    }

    const pgTourId = tourByName.get(tourName.toLowerCase().trim());
    if (!pgTourId) {
      warn(`  Tour "${tourName}" not found in PG (should not happen)`);
      pricesSkipped++;
      continue;
    }

    const adultNet  = ct.price_nett_adult  ? parseFloat(ct.price_nett_adult)  : null;
    const childNet  = ct.price_nett_child  ? parseFloat(ct.price_nett_child)  : null;

    const key = `${pgTourId}_${pgCompId}`;

    if (DRY_RUN) {
      log(`  [DRY] tour_price: tour=${pgTourId} (${tourName}) company=${pgCompId} adult_net=${adultNet} child_net=${childNet}`);
      pricesAdded++;
      continue;
    }

    if (existingPricesMap.has(key)) {
      // Update
      await pg.query(
        `UPDATE tour_prices SET adult_net=$1, child_net=$2, updated_at=NOW() WHERE id=$3`,
        [adultNet, childNet, existingPricesMap.get(key)]
      );
      pricesUpdated++;
    } else {
      // Insert
      const r = await pg.query(
        `INSERT INTO tour_prices (tour_id, company_id, adult_net, child_net, valid_from, valid_to, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, '2020-01-01', '2099-12-31', true, NOW(), NOW()) RETURNING id`,
        [pgTourId, pgCompId, adultNet, childNet]
      );
      existingPricesMap.set(key, r.rows[0].id);
      pricesAdded++;
    }
  }

  log('\n── SUMMARY ──');
  log(`Tours added: ${toursAdded}`);
  log(`Tour prices added: ${pricesAdded}`);
  log(`Tour prices updated: ${pricesUpdated}`);
  log(`Tour prices skipped: ${pricesSkipped}`);
  log('Done.');

  await pg.end();
}

main().catch(e => { console.error(e); process.exit(1); });
