const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tour_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE tour_prices
      ADD COLUMN IF NOT EXISTS article VARCHAR(100) DEFAULT ''
    `);
    console.log('OK: article column added to tour_prices');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();
