#!/usr/bin/env node
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

  // Check the specific vouchers from PostgreSQL sample
  const [rows] = await conn.execute(
    `SELECT voucher_number, client_datetime_trip FROM vouchers
     WHERE voucher_number IN (12564, 17235, 151007, 31900, 22882)
     ORDER BY voucher_number`
  );

  console.log('\n=== MySQL vs expected dates ===');
  console.log('Voucher | MySQL datetime (raw) | utc_date (old migration) | local_date (fix_dates)');
  for (const row of rows) {
    const dt = row.client_datetime_trip;
    if (!dt) { console.log(`${row.voucher_number} | NULL`); continue; }
    const utc = dt.toISOString().split('T')[0];
    const local = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    const diff = utc !== local ? ' ← БЫЛИ РАЗНЫЕ' : ' ← одинаковые';
    console.log(`${row.voucher_number} | ${dt} | utc=${utc} | local=${local}${diff}`);
  }

  // Also show statistics: how many have different utc vs local date
  const [all] = await conn.execute(
    `SELECT voucher_number, client_datetime_trip FROM vouchers WHERE client_datetime_trip IS NOT NULL`
  );

  let diffCount = 0;
  for (const row of all) {
    const dt = row.client_datetime_trip;
    if (!dt) continue;
    const utc = dt.toISOString().split('T')[0];
    const local = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    if (utc !== local) diffCount++;
  }
  console.log(`\nTotal vouchers with utc_date != local_date: ${diffCount} out of ${all.length}`);

  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
