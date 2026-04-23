-- migrate_015: Fix incorrect data from closeOperatorPeriod bug (17.04.2026)
-- Root cause: closeOperatorPeriod ran on 17.04 in two waves (09:30–09:34 and 18:47–19:05).
-- The function calculated deficit using ALL vouchers (no tour_date < beforeDate filter),
-- so April vouchers inflated the March writeoff amounts.
-- This migration:
--   Part 1 — revert 19 April vouchers wrongly marked operator_paid=true
--   Part 2 — correct 32 accounting_entries writeoff amounts to pre-April values
--            and delete the RITA TRANSFER entry (correct amount = 0)

-- ============================================================
-- Part 1: Roll back wrongly-marked April vouchers
-- 19 vouchers with tour_date >= 2026-04-01 marked during the two batch waves on 17.04
-- ============================================================
UPDATE vouchers
SET operator_paid = false, operator_paid_date = NULL
WHERE operator_paid = true
  AND is_deleted = false
  AND tour_date >= '2026-04-01'
  AND (
    updated_at BETWEEN '2026-04-17 09:30:00' AND '2026-04-17 09:35:00'
    OR updated_at BETWEEN '2026-04-17 18:47:00' AND '2026-04-17 19:06:00'
  );

-- ============================================================
-- Part 2a: Delete RITA TRANSFER writeoff (no March vouchers → correct amount = 0)
-- ============================================================
DELETE FROM accounting_entries WHERE id = 202;

-- ============================================================
-- Part 2b: Correct inflated writeoff amounts for remaining 31 companies
-- Format: id → company (was → now)
-- ============================================================
UPDATE accounting_entries SET amount = 55700   WHERE id = 194;  -- KB JETSKI:          113700 → 55700
UPDATE accounting_entries SET amount = 337300  WHERE id = 156;  -- ADVENTURE JETSKI:   388800 → 337300
UPDATE accounting_entries SET amount = 526600  WHERE id = 239;  -- CORAL LOUNGE:       562800 → 526600
UPDATE accounting_entries SET amount = 337200  WHERE id = 235;  -- SMILE TOUR:         367300 → 337200
UPDATE accounting_entries SET amount = 264750  WHERE id = 224;  -- SULEMAN:            287150 → 264750
UPDATE accounting_entries SET amount = 11800   WHERE id = 186;  -- AVIA TOURS:          31000 → 11800
UPDATE accounting_entries SET amount = 72850   WHERE id = 189;  -- BANGKEAW RAFTING:    88850 → 72850
UPDATE accounting_entries SET amount = 880722  WHERE id = 229;  -- JETSKI CLUB:        894972 → 880722
UPDATE accounting_entries SET amount = 88400   WHERE id = 242;  -- PP CRUISER:         101400 → 88400
UPDATE accounting_entries SET amount = 111100  WHERE id = 161;  -- WOW PHUKET:         120800 → 111100
UPDATE accounting_entries SET amount = 158600  WHERE id = 244;  -- SEA DELIGHT TOUR:   168200 → 158600
UPDATE accounting_entries SET amount = 383500  WHERE id = 157;  -- CARNIVAL:           392600 → 383500
UPDATE accounting_entries SET amount = 164900  WHERE id = 197;  -- LOVE ANDAMAN:       173900 → 164900
UPDATE accounting_entries SET amount = 315300  WHERE id = 220;  -- D-DAY:              323100 → 315300
UPDATE accounting_entries SET amount = 604700  WHERE id = 165;  -- SEA STAR:           612100 → 604700
UPDATE accounting_entries SET amount = 430900  WHERE id = 183;  -- ANDAMANDA PHUKET:   437900 → 430900
UPDATE accounting_entries SET amount = 59350   WHERE id = 243;  -- TI CLUB:             65550 → 59350
UPDATE accounting_entries SET amount = 143200  WHERE id = 205;  -- LANLALIN:           148400 → 143200
UPDATE accounting_entries SET amount = 94000   WHERE id = 199;  -- NARAYANA MARINE:     98000 → 94000
UPDATE accounting_entries SET amount = 7260    WHERE id = 240;  -- MANTRA FOREST SPA:   11220 → 7260
UPDATE accounting_entries SET amount = 60900   WHERE id = 158;  -- SOUTHERN HEIGHTS:    64800 → 60900
UPDATE accounting_entries SET amount = 32500   WHERE id = 160;  -- SUPER YACHT CLUB:    36100 → 32500
UPDATE accounting_entries SET amount = 44100   WHERE id = 216;  -- PHUKET ELEPHANT:     47500 → 44100
UPDATE accounting_entries SET amount = 107800  WHERE id = 213;  -- GOLDEN REGION:      110800 → 107800
UPDATE accounting_entries SET amount = 135500  WHERE id = 159;  -- SIAM NIRAMIT:       138500 → 135500
UPDATE accounting_entries SET amount = 20532   WHERE id = 221;  -- FLYING HANUMAN:      23000 → 20532
UPDATE accounting_entries SET amount = 181350  WHERE id = 241;  -- PHENPETH:           183150 → 181350
UPDATE accounting_entries SET amount = 51700   WHERE id = 198;  -- ELEPHANT CARE PARK:  53500 → 51700
UPDATE accounting_entries SET amount = 75600   WHERE id = 245;  -- WAKE UP CLUB:        77100 → 75600
UPDATE accounting_entries SET amount = 80100   WHERE id = 192;  -- BLUE PHOENIX:        81500 → 80100
UPDATE accounting_entries SET amount = 16100   WHERE id = 232;  -- PHUPHA ANDA TRAVEL:  16900 → 16100

-- ============================================================
-- Verification queries
-- ============================================================
-- Check: April vouchers with operator_paid=true (should be reduced by ~19)
SELECT COUNT(*) AS april_paid_count
FROM vouchers
WHERE operator_paid = true AND tour_date >= '2026-04-01' AND is_deleted = false;

-- Check: KB JETSKI entry (should now be 55700)
SELECT id, amount, notes FROM accounting_entries WHERE id = 194;

-- Check: RITA TRANSFER entry should be gone
SELECT COUNT(*) AS rita_count FROM accounting_entries WHERE id = 202;
