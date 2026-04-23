-- migrate_012: Add operator_paid_date column to vouchers
-- Agents already have agent_commission_paid_date; operators used updated_at as proxy — unreliable.

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS operator_paid_date DATE;

-- Backfill: for already-paid vouchers, use updated_at as best approximation
UPDATE vouchers
SET operator_paid_date = updated_at::date
WHERE operator_paid = true AND operator_paid_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_vouchers_operator_paid_date ON vouchers(operator_paid_date);
