-- migrate_006.sql
-- cash_on_tour учитывается в payment_status как "Депозит в компанию"

-- 1. Обновить функцию триггера на таблице payments
CREATE OR REPLACE FUNCTION update_voucher_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_id   INTEGER;
  v_paid NUMERIC;
  v_cash NUMERIC;
  v_sale NUMERIC;
BEGIN
  v_id := COALESCE(NEW.voucher_id, OLD.voucher_id);

  SELECT COALESCE(SUM(amount), 0)
    INTO v_paid
    FROM payments
   WHERE voucher_id = v_id;

  SELECT COALESCE(cash_on_tour, 0), total_sale
    INTO v_cash, v_sale
    FROM vouchers
   WHERE id = v_id;

  UPDATE vouchers SET
    paid_to_agency = v_paid,
    payment_status = CASE
      WHEN v_paid + v_cash = 0              THEN 'unpaid'
      WHEN v_paid + v_cash >= v_sale        THEN 'paid'
      ELSE                                       'partial'
    END
  WHERE id = v_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. Новая функция + триггер на таблице vouchers:
--    пересчитать payment_status при изменении cash_on_tour или total_sale
CREATE OR REPLACE FUNCTION recalc_status_on_voucher()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cash_on_tour IS DISTINCT FROM OLD.cash_on_tour
     OR NEW.total_sale IS DISTINCT FROM OLD.total_sale THEN
    NEW.payment_status := CASE
      WHEN COALESCE(NEW.paid_to_agency, 0) + COALESCE(NEW.cash_on_tour, 0) = 0
           THEN 'unpaid'
      WHEN COALESCE(NEW.paid_to_agency, 0) + COALESCE(NEW.cash_on_tour, 0) >= NEW.total_sale
           THEN 'paid'
      ELSE 'partial'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalc_status_on_voucher ON vouchers;
CREATE TRIGGER trigger_recalc_status_on_voucher
  BEFORE UPDATE OF cash_on_tour, total_sale ON vouchers
  FOR EACH ROW EXECUTE FUNCTION recalc_status_on_voucher();

-- 3. Бэкфилл: пересчитать существующие ваучеры с cash_on_tour > 0
UPDATE vouchers SET
  payment_status = CASE
    WHEN COALESCE(paid_to_agency, 0) + COALESCE(cash_on_tour, 0) = 0
         THEN 'unpaid'
    WHEN COALESCE(paid_to_agency, 0) + COALESCE(cash_on_tour, 0) >= total_sale
         THEN 'paid'
    ELSE 'partial'
  END
WHERE COALESCE(cash_on_tour, 0) > 0;
