-- migrate_014: Normalize messy payment_method values in accounting_entries
-- Old system used payment_method as a free-text field (e.g. "ОКСАНА СБЕРБАНК", "cash", "КАРОН").
-- This migration consolidates all non-standard values into clean categories.

UPDATE accounting_entries
SET payment_method = CASE

  -- Депозит в компанию
  WHEN payment_method ILIKE '%депозит%' OR payment_method ILIKE '%deposit%'
    THEN 'Депозит в компанию'

  -- Обменник (exchange office)
  WHEN payment_method ILIKE '%обменник%' OR payment_method ILIKE '%обмееник%'
    OR payment_method = 'НА ОБМЕННИК' OR payment_method ILIKE 'exchang%'
    THEN 'Обменник'

  -- Кошелёк (wallet — without обменник)
  WHEN (payment_method ILIKE '%кошелёк%' OR payment_method ILIKE '%кошелек%'
        OR payment_method ILIKE '%wallet%')
    AND payment_method NOT ILIKE '%обменник%'
    THEN 'Кошелёк'

  -- Наличные офис (cash at office/location)
  WHEN payment_method ILIKE '%наличн%'
    OR payment_method ILIKE '%cash%'
    OR payment_method ILIKE '%офис%' OR payment_method ILIKE '%office%'
    OR payment_method ILIKE '%карон%' OR payment_method ILIKE '%karon%'
    OR payment_method ILIKE 'ката%' OR payment_method ILIKE 'kata %'
    OR payment_method = 'KATA' OR payment_method = 'SE'
    OR payment_method ILIKE '%7/11%' OR payment_method ILIKE '%7-11%'
    OR payment_method ILIKE '%bkk%'
    OR payment_method ILIKE '%nikorn%'
    OR payment_method ILIKE '%off kata%'
    THEN 'Наличные офис'

  -- Перевод на карту (Russian/international bank transfers)
  WHEN payment_method ILIKE '%сбер%'
    OR payment_method ILIKE '%тинькоф%' OR payment_method ILIKE '%тинкоф%'
    OR payment_method ILIKE '%tinkoff%' OR payment_method ILIKE '%tink%'
    OR payment_method ILIKE '%альфа%'
    OR payment_method ILIKE '%касикорн%' OR payment_method ILIKE '%kasikorn%'
    OR payment_method ILIKE '%scb%'
    OR payment_method ILIKE '%перевод%'
    OR payment_method ILIKE '%₽%' OR payment_method ILIKE '%руб%'
    OR payment_method ILIKE '%rub%'
    OR payment_method ILIKE '%владимир%' OR payment_method ILIKE '%vladimir%'
    OR payment_method ILIKE '%марина%' OR payment_method ILIKE '%marina%'
    OR payment_method ILIKE '%рагутск%'
    OR payment_method ILIKE '%нагорнов%'
    OR payment_method = 'ИП'
    THEN 'Перевод на карту'

  -- Остальное → Другое
  ELSE 'Другое'

END
WHERE payment_id IS NOT NULL
  AND payment_method NOT IN (
    '7-Eleven', 'Депозит в компанию', 'Другое', 'Карта Оксана',
    'Кошелёк', 'Наличные офис', 'Не указан', 'Обменник',
    'Счёт Оксана', 'Перевод на карту', 'USDT', 'списание'
  )
  AND payment_method IS NOT NULL
  AND payment_method != '';

-- Report what we ended up with
SELECT payment_method, COUNT(*) AS cnt,
       ROUND(SUM(CASE WHEN entry_type='income' THEN amount ELSE -amount END)) AS balance
FROM accounting_entries
WHERE payment_id IS NOT NULL
GROUP BY payment_method
ORDER BY cnt DESC;
