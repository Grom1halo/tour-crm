#!/usr/bin/env node
/**
 * Generates SQL UPDATE statements to fix tour_date values
 * that were shifted -1 day during MySQL→PostgreSQL migration.
 *
 * Run: node fix_dates.js > fix_dates.sql
 * Then upload fix_dates.sql to server and run:
 *   PGPASSWORD=348004 psql -h localhost -U tour_crm_user -d tour_crm -f fix_dates.sql
 */
'use strict';

const mysql = require('mysql2/promise');

const MYSQL_CONFIG = {
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306'),
  user:     process.env.MYSQL_USER     || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB       || 'ci19820_voucher2',
  charset:  'utf8mb4',
};

async function main() {
  const conn = await mysql.createConnection(MYSQL_CONFIG);

  const [rows] = await conn.execute(
    'SELECT voucher_number, client_datetime_trip FROM vouchers WHERE client_datetime_trip IS NOT NULL'
  );

  await conn.end();

  const updates = [];
  for (const row of rows) {
    if (!row.client_datetime_trip) continue;

    const dt = new Date(row.client_datetime_trip);
    if (isNaN(dt)) continue;

    // Use LOCAL date (Bangkok) — same as what the user intended
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const correctDate = `${y}-${m}-${d}`;

    const num = row.voucher_number.toString().replace(/'/g, "''");
    updates.push(`UPDATE vouchers SET tour_date = '${correctDate}' WHERE voucher_number = '${num}';`);
  }

  console.log(`-- Generated ${updates.length} date fixes`);
  console.log(`-- Run this on the server PostgreSQL database`);
  console.log('BEGIN;');
  for (const u of updates) {
    console.log(u);
  }
  console.log('COMMIT;');
  process.stderr.write(`Done: ${updates.length} vouchers\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
