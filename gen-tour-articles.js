#!/usr/bin/env node
'use strict';
const { Pool } = require('pg');
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: process.env.PG_PASSWORD || '', database: 'tour_crm' });

const SKIP = new Set(['A','AN','THE','AND','OR','BY','FOR','OF','ON','IN','TO','AT','NO','WITH','WITHOUT','DAY','DAYS','NIGHT','NIGHTS']);

function makeBase(name) {
  const words = name.toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !SKIP.has(w));

  if (words.length === 0) return name.replace(/[^A-Z0-9]/gi, '').substring(0, 8).toUpperCase();

  // Build article from key words
  if (words.length === 1) return words[0].substring(0, 8);
  if (words.length === 2) return `${words[0].substring(0,4)}-${words[1].substring(0,4)}`;

  // 3+ words: take first 3 chars of first 3 significant words
  const parts = words.slice(0, 3).map(w => w.substring(0, 3));
  return parts.join('-');
}

async function main() {
  await pool.query('SELECT 1');

  // Load all existing articles to avoid collisions
  const existing = await pool.query('SELECT article FROM tours WHERE article IS NOT NULL AND article != \'\'');
  const usedArticles = new Set(existing.rows.map(r => r.article.toUpperCase()));

  // Load tours without articles
  const tours = await pool.query('SELECT id, name FROM tours WHERE article IS NULL OR article = \'\' ORDER BY name');
  console.log(`Tours to process: ${tours.rows.length}`);

  let updated = 0;
  for (const tour of tours.rows) {
    let base = makeBase(tour.name).replace(/-+$/, ''); // remove trailing dashes
    let article = base;
    let n = 2;
    while (usedArticles.has(article.toUpperCase())) {
      article = `${base}${n++}`;
    }
    usedArticles.add(article.toUpperCase());

    if (DRY_RUN) {
      console.log(`"${tour.name}" → ${article}`);
    } else {
      await pool.query('UPDATE tours SET article = $1 WHERE id = $2', [article, tour.id]);
      updated++;
    }
  }

  if (!DRY_RUN) console.log(`Updated: ${updated} tours`);
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
