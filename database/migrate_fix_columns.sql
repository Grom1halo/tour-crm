-- migrate_fix_columns.sql
-- Add missing columns that were in schema.sql / migrate_001.sql / migrate_v2.sql
-- but never applied to production

-- tours: missing article, cancellation_terms, needs_attention
ALTER TABLE tours ADD COLUMN IF NOT EXISTS article VARCHAR(100) DEFAULT '';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS cancellation_terms TEXT[] DEFAULT '{}';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS needs_attention BOOLEAN DEFAULT false;

-- vouchers: missing tour_date_end, currency
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS tour_date_end DATE;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'THB';
