import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Return DATE columns as plain strings (e.g. "2026-04-03") instead of Date objects.
// Without this, pg converts DATE to a JS Date at midnight Moscow time (UTC+3),
// which shifts dates by 3 hours and breaks date comparisons in UTC.
types.setTypeParser(1082, (val: string) => val);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tour_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('connect', () => {
  console.log('✓ Database connected');
});

pool.on('error', (err) => {
  console.error('Database error:', err);
  process.exit(-1);
});

export default pool;
