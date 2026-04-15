-- migrate_004.sql
-- Add client_name, client_phone (free text) and hotline_phone to vouchers
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS client_name VARCHAR(300);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS client_phone VARCHAR(100);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS hotline_phone VARCHAR(50) DEFAULT '+66 65 706 3341';

-- Backfill client_name/phone from clients table for existing vouchers
UPDATE vouchers v
SET client_name = c.name, client_phone = c.phone
FROM clients c
WHERE v.client_id = c.id AND v.client_name IS NULL;

-- Set default hotline for existing vouchers that don't have it
UPDATE vouchers SET hotline_phone = '+66 65 706 3341' WHERE hotline_phone IS NULL;
