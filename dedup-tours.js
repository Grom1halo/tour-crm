#!/usr/bin/env node
/**
 * dedup-tours.js
 * - Finds duplicate tours (same name)
 * - Keeps the one with the lowest ID (has article)
 * - Moves tour_prices from duplicates to primary (skip if company already has price for primary)
 * - Updates vouchers to point to primary tour_id
 * - Deletes duplicate tours
 *
 * Usage: node dedup-tours.js [--dry-run]
 */
'use strict';

const { Pool } = require('pg');
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  host: 'localhost', port: 5432,
  user: 'postgres', password: process.env.PG_PASSWORD || '',
  database: 'tour_crm',
});

function log(msg)  { console.log(`[INFO]  ${msg}`); }
function warn(msg) { console.warn(`[WARN]  ${msg}`); }

async function main() {
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  await pool.query('SELECT 1');
  log('PostgreSQL connected');

  // Find all duplicate groups
  const dupRes = await pool.query(`
    SELECT name, array_agg(id ORDER BY id) as ids
    FROM tours
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY name
  `);
  log(`Duplicate groups: ${dupRes.rows.length}`);

  let totalPricesMoved = 0, totalPricesSkipped = 0;
  let totalVouchersUpdated = 0, totalToursDeleted = 0;

  for (const row of dupRes.rows) {
    const primaryId = row.ids[0];
    const dupIds = row.ids.slice(1);
    log(`\n"${row.name}" — keep ID ${primaryId}, remove IDs [${dupIds.join(', ')}]`);

    for (const dupId of dupIds) {
      // 1. Move tour_prices from dup to primary
      const pricesRes = await pool.query(
        'SELECT * FROM tour_prices WHERE tour_id = $1', [dupId]
      );

      for (const price of pricesRes.rows) {
        // Check if primary already has a price for this company with overlapping period
        const exists = await pool.query(`
          SELECT id FROM tour_prices
          WHERE tour_id = $1 AND company_id = $2
            AND valid_from <= $3 AND valid_to >= $4
        `, [primaryId, price.company_id, price.valid_to, price.valid_from]);

        if (exists.rows.length > 0) {
          warn(`  Price for company ${price.company_id} already exists on primary — skip`);
          totalPricesSkipped++;
        } else {
          if (!DRY_RUN) {
            await pool.query(`
              INSERT INTO tour_prices (
                tour_id, company_id, valid_from, valid_to, article,
                adult_net, child_net, infant_net, transfer_net, other_net,
                adult_sale, child_sale, infant_sale, transfer_sale, other_sale,
                is_active, created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            `, [
              primaryId, price.company_id, price.valid_from, price.valid_to, price.article || '',
              price.adult_net, price.child_net, price.infant_net, price.transfer_net, price.other_net,
              price.adult_sale, price.child_sale, price.infant_sale, price.transfer_sale, price.other_sale,
              price.is_active, price.created_at, price.updated_at,
            ]);
          }
          log(`  Moved price (company ${price.company_id}) from tour ${dupId} → ${primaryId}`);
          totalPricesMoved++;
        }
      }

      // 2. Update vouchers
      const vRes = await pool.query(
        'SELECT COUNT(*) FROM vouchers WHERE tour_id = $1', [dupId]
      );
      const vCount = parseInt(vRes.rows[0].count);
      if (vCount > 0) {
        if (!DRY_RUN) {
          await pool.query('UPDATE vouchers SET tour_id = $1 WHERE tour_id = $2', [primaryId, dupId]);
        }
        log(`  Updated ${vCount} vouchers: tour_id ${dupId} → ${primaryId}`);
        totalVouchersUpdated += vCount;
      }

      // 3. Delete the duplicate tour
      if (!DRY_RUN) {
        await pool.query('DELETE FROM tour_prices WHERE tour_id = $1', [dupId]);
        await pool.query('DELETE FROM tours WHERE id = $1', [dupId]);
      }
      log(`  Deleted tour ID ${dupId}`);
      totalToursDeleted++;
    }
  }

  log('\n── SUMMARY ──');
  log(`Prices moved: ${totalPricesMoved}`);
  log(`Prices skipped (overlap): ${totalPricesSkipped}`);
  log(`Vouchers updated: ${totalVouchersUpdated}`);
  log(`Tours deleted: ${totalToursDeleted}`);
  log('Done.');

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
