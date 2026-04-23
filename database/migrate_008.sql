-- migrate_008: Dynamic payment methods table

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,  -- system methods cannot be deleted
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO payment_methods (name, is_system, sort_order) VALUES
  ('Наличные офис',      false, 1),
  ('Счёт Оксана',        false, 2),
  ('Обменник',           false, 3),
  ('Кошелёк',            false, 4),
  ('7-Eleven',           false, 5),
  ('TFP Phuket',         false, 6),
  ('Карта Оксана',       false, 7),
  ('Перевод',            false, 8),
  ('Другое',             false, 9),
  ('Депозит в компанию', true,  10)
ON CONFLICT (name) DO NOTHING;
