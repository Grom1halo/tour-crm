#!/usr/bin/env node
/**
 * Repair script: fix client records merged into one "SERGEY" client
 * during initial migration (all no-phone vouchers shared one client_id).
 *
 * What it does:
 *   1. Finds vouchers in PostgreSQL where client_id points to a single merged client
 *      (detected by: many vouchers share same client_id AND client phone = '-' or '')
 *   2. For each affected voucher, reads the real client_name from MySQL
 *   3. Creates a new client record (or reuses existing) with the real name
 *   4. Updates voucher.client_id to the correct client
 *
 * Usage:
 *   node repair-clients.js [--dry-run]
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
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DB       || 'tour_crm',
};

const DRY_RUN = process.argv.includes('--dry-run');

function s(v) { return (v || '').toString().trim(); }

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE REPAIR'}`);

  const my = await mysql.createConnection(MYSQL_CONFIG);
  const pg = new Pool(PG_CONFIG);

  // 1. Find all "merged" client IDs in PostgreSQL:
  //    clients that have many vouchers AND phone is empty/dash
  console.log('\nStep 1: Finding merged client IDs in PostgreSQL...');
  const mergedResult = await pg.query(`
    SELECT c.id, c.name, c.phone, c.manager_id, COUNT(v.id) as voucher_count
    FROM clients c
    JOIN vouchers v ON v.client_id = c.id
    WHERE (c.phone = '' OR c.phone = '-' OR c.phone IS NULL)
    GROUP BY c.id, c.name, c.phone, c.manager_id
    HAVING COUNT(v.id) > 5
    ORDER BY voucher_count DESC
  `);

  if (mergedResult.rows.length === 0) {
    console.log('No merged clients found. Nothing to repair.');
    await my.end();
    await pg.end();
    return;
  }

  console.log(`Found ${mergedResult.rows.length} merged client(s):`);
  for (const c of mergedResult.rows) {
    console.log(`  client_id=${c.id} name="${c.name}" phone="${c.phone}" manager_id=${c.manager_id} vouchers=${c.voucher_count}`);
  }

  // 2. For each merged client, fix all vouchers
  for (const mergedClient of mergedResult.rows) {
    console.log(`\nStep 2: Repairing client_id=${mergedClient.id} ("${mergedClient.name}")...`);

    // Get all voucher_numbers in PostgreSQL that use this client
    const pgVouchers = await pg.query(
      `SELECT id, voucher_number FROM vouchers WHERE client_id = $1 ORDER BY id`,
      [mergedClient.id]
    );
    const voucherNumbers = pgVouchers.rows.map(r => s(r.voucher_number)).filter(Boolean);
    console.log(`  Affected vouchers: ${voucherNumbers.length}`);

    // Get real client names from MySQL for these voucher numbers
    if (voucherNumbers.length === 0) continue;

    const placeholders = voucherNumbers.map((_, i) => `?`).join(',');
    const [mysqlRows] = await my.execute(
      `SELECT voucher_number, client_name, client_phone, voucher_created_user_id
       FROM vouchers
       WHERE voucher_number IN (${placeholders})`,
      voucherNumbers
    );

    // Build map: voucher_number → {client_name, client_phone, manager_old_id}
    const mysqlMap = new Map();
    for (const row of mysqlRows) {
      mysqlMap.set(s(row.voucher_number), {
        name:  s(row.client_name),
        phone: s(row.client_phone),
        oldManagerId: row.voucher_created_user_id,
      });
    }

    console.log(`  Found ${mysqlMap.size} matches in MySQL`);

    // For each PG voucher, fix the client
    let fixed = 0, skipped = 0, notInMysql = 0;

    for (const pgV of pgVouchers.rows) {
      const mysqlData = mysqlMap.get(pgV.voucher_number);
      if (!mysqlData) {
        // Voucher not in MySQL → created in new system, skip
        notInMysql++;
        continue;
      }

      const realName  = mysqlData.name  || 'Unknown';
      const realPhone = (mysqlData.phone && mysqlData.phone !== '-') ? mysqlData.phone : null;

      // Get manager_id in PostgreSQL for this voucher
      const voucherRow = await pg.query(
        `SELECT manager_id FROM vouchers WHERE id = $1`,
        [pgV.id]
      );
      const managerId = voucherRow.rows[0]?.manager_id;
      if (!managerId) { skipped++; continue; }

      if (DRY_RUN) {
        console.log(`  [DRY] voucher ${pgV.voucher_number}: "${mergedClient.name}" → "${realName}" phone=${realPhone}`);
        fixed++;
        continue;
      }

      // Find or create correct client
      let correctClientId;

      if (realPhone) {
        // Has phone: find or create proper client record
        const existing = await pg.query(
          `SELECT id FROM clients WHERE phone = $1 AND manager_id = $2 LIMIT 1`,
          [realPhone, managerId]
        );
        if (existing.rows.length > 0) {
          correctClientId = existing.rows[0].id;
        } else {
          const created = await pg.query(
            `INSERT INTO clients (name, phone, manager_id) VALUES ($1, $2, $3) RETURNING id`,
            [realName, realPhone, managerId]
          );
          correctClientId = created.rows[0].id;
        }
        // Update voucher with proper client_id and real name
        await pg.query(
          `UPDATE vouchers SET client_id = $1, client_name = $2, client_phone = $3 WHERE id = $4`,
          [correctClientId, realName, realPhone, pgV.id]
        );
      } else {
        // No phone: unique constraint prevents multiple clients with empty phone per manager.
        // Store real name directly on voucher, clear the merged client_id.
        await pg.query(
          `UPDATE vouchers SET client_id = NULL, client_name = $1, client_phone = '' WHERE id = $2`,
          [realName, pgV.id]
        );
      }
      fixed++;
    }

    console.log(`  Fixed: ${fixed}, Skipped: ${skipped}, Not in MySQL (new system): ${notInMysql}`);
  }

  console.log('\nRepair complete.');
  await my.end();
  await pg.end();
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
