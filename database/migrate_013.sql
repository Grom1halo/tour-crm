-- migrate_013: Backfill accounting_entries from historical payments
-- Before April 14, 2026 the cashflow journal didn't exist.
-- This creates accounting_entries for all payments that don't have one yet.
-- Old payments used payment_method as free-text (up to 174 chars);
-- we truncate to 50 and move the overflow into notes.

INSERT INTO accounting_entries
  (entry_date, entry_type, payment_method, counterparty_name, company_id,
   amount, notes, category, source, payment_id, currency, requires_confirmation, created_by)
SELECT
  p.payment_date::date                                   AS entry_date,
  CASE
    WHEN p.is_refund = true                              THEN 'expense'
    WHEN p.payment_method = 'Депозит в компанию'        THEN 'expense'
    ELSE 'income'
  END                                                    AS entry_type,
  -- Truncate to 50 chars; if longer it was a free-text comment, moves to notes below
  LEFT(p.payment_method, 50)                             AS payment_method,
  COALESCE('Ваучер ' || v.voucher_number,
           'Ваучер #' || p.voucher_id::text)             AS counterparty_name,
  CASE
    WHEN p.payment_method = 'Депозит в компанию'
      THEN COALESCE(p.company_id, v.company_id)
    ELSE NULL
  END                                                    AS company_id,
  p.amount,
  -- Combine original long payment_method (if truncated) with existing notes
  CASE
    WHEN LENGTH(p.payment_method) > 50
      THEN TRIM(COALESCE(p.notes || ' | ', '') || p.payment_method)
    ELSE p.notes
  END                                                    AS notes,
  CASE
    WHEN p.is_refund = true                              THEN 'Возврат'
    WHEN p.payment_method = 'Депозит в компанию'        THEN 'Депозит в компанию'
    ELSE 'Оплата тура'
  END                                                    AS category,
  'auto'                                                 AS source,
  p.id                                                   AS payment_id,
  COALESCE(v.currency, 'THB')                            AS currency,
  false                                                  AS requires_confirmation,
  p.created_by
FROM payments p
JOIN vouchers v ON p.voucher_id = v.id
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_entries ae WHERE ae.payment_id = p.id
);
