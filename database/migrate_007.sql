-- migrate_007: Add currency to accounting_entries
-- Allows tracking THB vs VND cash movements separately

ALTER TABLE accounting_entries ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'THB';

-- Back-fill: set currency from linked voucher (for auto-created entries)
UPDATE accounting_entries ae
SET currency = COALESCE(v.currency, 'THB')
FROM payments p
JOIN vouchers v ON p.voucher_id = v.id
WHERE ae.payment_id = p.id
  AND ae.currency IS NULL;

-- Remaining entries (manual, no payment_id) stay as 'THB' (default)
UPDATE accounting_entries SET currency = 'THB' WHERE currency IS NULL;
