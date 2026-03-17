-- Migration v2: new fields for vouchers, users, payments

-- Vouchers: tour end date, important flag, cancellation notes
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS tour_date_end DATE,
  ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;

-- Users: manager phone number
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(50);

-- Payments: currency (default THB)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'THB';

-- Index for important vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_important ON vouchers(is_important) WHERE is_important = true;
