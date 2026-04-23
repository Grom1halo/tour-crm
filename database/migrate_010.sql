-- migrate_010.sql
-- Исправление данных после некорректного запуска closeOperatorPeriod 17.04.2026:
--   1. Откат апрельских ваучеров (operator_paid → false)
--   2. Коррекция сумм списания по 32 компаниям (до pre-April значений)
--   3. Удаление нулевой записи списания RITA TRANSFER

BEGIN;

-- ===== ЧАСТЬ 1: Откат ошибочно помеченных апрельских ваучеров =====
-- 19 ваучеров с tour_date >= 2026-04-01, помеченных в ходе двух batch-волн 17.04.2026
-- (утренней 09:30–09:34 и вечерней 18:47–19:05)
UPDATE vouchers
SET operator_paid = false
WHERE operator_paid = true
  AND is_deleted = false
  AND tour_date >= '2026-04-01'
  AND (
    updated_at BETWEEN '2026-04-17 09:30:00' AND '2026-04-17 09:35:00'
    OR updated_at BETWEEN '2026-04-17 18:47:00' AND '2026-04-17 19:06:00'
  );

-- ===== ЧАСТЬ 2: Удаление нулевого списания RITA TRANSFER =====
-- У RITA TRANSFER нет мартовских ваучеров, правильная сумма = 0
DELETE FROM accounting_entries WHERE id = 202 AND category = 'Списание долга';

-- ===== ЧАСТЬ 3: Коррекция сумм списания до pre-April значений =====
UPDATE accounting_entries SET amount = 55700   WHERE id = 194;  -- KB JETSKI          113700 → 55700
UPDATE accounting_entries SET amount = 337300  WHERE id = 156;  -- ADVENTURE JETSKI   388800 → 337300
UPDATE accounting_entries SET amount = 526600  WHERE id = 239;  -- CORAL LOUNGE       562800 → 526600
UPDATE accounting_entries SET amount = 337200  WHERE id = 235;  -- SMILE TOUR         367300 → 337200
UPDATE accounting_entries SET amount = 264750  WHERE id = 224;  -- SULEMAN            287150 → 264750
UPDATE accounting_entries SET amount = 11800   WHERE id = 186;  -- AVIA TOURS          31000 → 11800
UPDATE accounting_entries SET amount = 72850   WHERE id = 189;  -- BANGKEAW RAFTING    88850 → 72850
UPDATE accounting_entries SET amount = 880722  WHERE id = 229;  -- JETSKI CLUB        894972 → 880722
UPDATE accounting_entries SET amount = 88400   WHERE id = 242;  -- PP CRUISER         101400 → 88400
UPDATE accounting_entries SET amount = 111100  WHERE id = 161;  -- WOW PHUKET         120800 → 111100
UPDATE accounting_entries SET amount = 158600  WHERE id = 244;  -- SEA DELIGHT TOUR   168200 → 158600
UPDATE accounting_entries SET amount = 383500  WHERE id = 157;  -- CARNIVAL           392600 → 383500
UPDATE accounting_entries SET amount = 164900  WHERE id = 197;  -- LOVE ANDAMAN       173900 → 164900
UPDATE accounting_entries SET amount = 315300  WHERE id = 220;  -- D-DAY              323100 → 315300
UPDATE accounting_entries SET amount = 604700  WHERE id = 165;  -- SEA STAR           612100 → 604700
UPDATE accounting_entries SET amount = 430900  WHERE id = 183;  -- ANDAMANDA PHUKET   437900 → 430900
UPDATE accounting_entries SET amount = 59350   WHERE id = 243;  -- ti club             65550 → 59350
UPDATE accounting_entries SET amount = 143200  WHERE id = 205;  -- LANLALIN           148400 → 143200
UPDATE accounting_entries SET amount = 94000   WHERE id = 199;  -- NARAYANA MARINE     98000 → 94000
UPDATE accounting_entries SET amount = 7260    WHERE id = 240;  -- MANTRA FOREST SPA   11220 → 7260
UPDATE accounting_entries SET amount = 60900   WHERE id = 158;  -- SOUTHERN HEIGHTS    64800 → 60900
UPDATE accounting_entries SET amount = 32500   WHERE id = 160;  -- SUPER YACHT CLUB    36100 → 32500
UPDATE accounting_entries SET amount = 44100   WHERE id = 216;  -- PHUKET ELEPHANT     47500 → 44100
UPDATE accounting_entries SET amount = 107800  WHERE id = 213;  -- GOLDEN REGION      110800 → 107800
UPDATE accounting_entries SET amount = 135500  WHERE id = 159;  -- SIAM NIRAMIT       138500 → 135500
UPDATE accounting_entries SET amount = 20532   WHERE id = 221;  -- FLYING HANUMAN      23000 → 20532
UPDATE accounting_entries SET amount = 181350  WHERE id = 241;  -- PHENPETH           183150 → 181350
UPDATE accounting_entries SET amount = 51700   WHERE id = 198;  -- ELEPHANT CARE PARK  53500 → 51700
UPDATE accounting_entries SET amount = 75600   WHERE id = 245;  -- WAKE UP CLUB        77100 → 75600
UPDATE accounting_entries SET amount = 80100   WHERE id = 192;  -- BLUE PHOENIX        81500 → 80100
UPDATE accounting_entries SET amount = 16100   WHERE id = 232;  -- PHUPHA ANDA TRAVEL  16900 → 16100

COMMIT;
