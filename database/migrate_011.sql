-- migrate_011.sql
-- Массовая коррекция сумм списания долга для всех компаний.
-- Причина: closeOperatorPeriod использовал ALL-TIME expense-записи вместо
-- записей до даты закрытия периода, и GREATEST(net-cash,0) вместо (net-cash).
-- Оба бага теперь исправлены в коде (accountingController.ts).
-- Ниже — исправление уже существующих записей в БД.

BEGIN;

-- Компании, где списание было МАЛО (апрельские платежи вычлись из мартового долга)
UPDATE accounting_entries SET amount = 388800 WHERE id = 156; -- ADVENTURE JETSKI   337300 → 388800
UPDATE accounting_entries SET amount = 369200 WHERE id = 235; -- SMILE TOUR         337200 → 369200
UPDATE accounting_entries SET amount = 555300 WHERE id = 239; -- CORAL LOUNGE       526600 → 555300
UPDATE accounting_entries SET amount =  31000 WHERE id = 186; -- AVIA TOURS          11800 → 31000
UPDATE accounting_entries SET amount = 127500 WHERE id = 161; -- WOW PHUKET         111100 → 127500
UPDATE accounting_entries SET amount =  65700 WHERE id = 194; -- KB JETSKI           55700 → 65700
UPDATE accounting_entries SET amount =  95500 WHERE id = 242; -- PP CRUISER          88400 → 95500
UPDATE accounting_entries SET amount = 437900 WHERE id = 183; -- ANDAMANDA PHUKET   430900 → 437900
UPDATE accounting_entries SET amount = 163000 WHERE id = 244; -- SEA DELIGHT TOUR   158600 → 163000
UPDATE accounting_entries SET amount =  98000 WHERE id = 199; -- NARAYANA MARINE     94000 → 98000
UPDATE accounting_entries SET amount = 153100 WHERE id = 238; -- FANTASEA           150200 → 153100
UPDATE accounting_entries SET amount =  63700 WHERE id = 158; -- SOUTHERN HEIGHTS    60900 → 63700
UPDATE accounting_entries SET amount =  23000 WHERE id = 221; -- FLYING HANUMAN      20532 → 23000
UPDATE accounting_entries SET amount =  46500 WHERE id = 216; -- PHUKET ELEPHANT     44100 → 46500
UPDATE accounting_entries SET amount = 317600 WHERE id = 220; -- D-DAY              315300 → 317600
UPDATE accounting_entries SET amount =   9240 WHERE id = 240; -- MANTRA FOREST SPA    7260 → 9240
UPDATE accounting_entries SET amount = 166700 WHERE id = 197; -- LOVE ANDAMAN       164900 → 166700
UPDATE accounting_entries SET amount =  16900 WHERE id = 232; -- PHUPHA ANDA TRAVEL  16100 → 16900

-- Компании, где списание было ВЕЛИКО (cash_on_tour превышал нетто — GREATEST дал лишний зачёт)
UPDATE accounting_entries SET amount =  58700 WHERE id = 245; -- WAKE UP CLUB        75600 → 58700
UPDATE accounting_entries SET amount = 246603 WHERE id = 208; -- RS JETSKI          256803 → 246603
UPDATE accounting_entries SET amount =  41000 WHERE id = 215; -- PHUCHADA            46700 → 41000
UPDATE accounting_entries SET amount = 260250 WHERE id = 224; -- SULEMAN            264750 → 260250
UPDATE accounting_entries SET amount =  48300 WHERE id = 198; -- ELEPHANT CARE PARK  51700 → 48300
UPDATE accounting_entries SET amount = 178850 WHERE id = 241; -- PHENPETH           181350 → 178850
UPDATE accounting_entries SET amount =    500 WHERE id = 218; -- PP SABAI             2000 → 500
UPDATE accounting_entries SET amount = 879522 WHERE id = 229; -- JETSKI CLUB        880722 → 879522
UPDATE accounting_entries SET amount =  14300 WHERE id = 228; -- PRASERT             15100 → 14300
UPDATE accounting_entries SET amount = 383150 WHERE id = 157; -- CARNIVAL           383500 → 383150
UPDATE accounting_entries SET amount =  49400 WHERE id = 211; -- JP ANDAMAN          49700 → 49400
UPDATE accounting_entries SET amount =  23100 WHERE id = 222; -- PATRIK              23400 → 23100
UPDATE accounting_entries SET amount = 107500 WHERE id = 213; -- GOLDEN REGION      107800 → 107500
UPDATE accounting_entries SET amount = 135350 WHERE id = 159; -- SIAM NIRAMIT       135500 → 135350

COMMIT;
