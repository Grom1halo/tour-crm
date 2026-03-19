const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tour_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function run() {
  try {
    const res = await pool.query('SELECT id, name, tour_type, article FROM tours ORDER BY name');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
