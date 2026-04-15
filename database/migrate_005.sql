-- migrate_005.sql
-- 1. operator_paid flag on vouchers (for operator reconciliation)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS operator_paid BOOLEAN DEFAULT false;

-- 2. is_refund flag on payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT false;

-- 3. requires_confirmation flag on accounting_entries
ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT false;

-- 4. tour_details for manual tour name entry (Vietnam)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS tour_details TEXT;

-- 5. cash_on_tour for cash collected during tour
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS cash_on_tour NUMERIC(12,2) DEFAULT 0;

-- 6. Add 'vietnam' to tour_type CHECK constraint
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_tour_type_check;
ALTER TABLE vouchers ADD CONSTRAINT vouchers_tour_type_check
  CHECK (tour_type IN ('group', 'individual', 'tourflot', 'jetski', 'vietnam'));
