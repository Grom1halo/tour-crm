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
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS voucher_counter INTEGER DEFAULT 499
    `);
    console.log('OK: voucher_counter column added');

    // Show current state
    const res = await pool.query('SELECT id, full_name, manager_number, voucher_counter FROM users ORDER BY manager_number');
    console.log('Users:', res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();
