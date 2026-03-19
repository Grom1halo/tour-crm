CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    label VARCHAR(200) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed with common presets
INSERT INTO seasons (label, valid_from, valid_to, sort_order) VALUES
  ('Высокий сезон 2024–2025', '2024-11-01', '2025-04-30', 10),
  ('Низкий сезон 2025',       '2025-05-01', '2025-10-31', 20),
  ('Высокий сезон 2025–2026', '2025-11-01', '2026-04-30', 30),
  ('Низкий сезон 2026',       '2026-05-01', '2026-10-31', 40),
  ('Высокий сезон 2026–2027', '2026-11-01', '2027-04-30', 50)
ON CONFLICT DO NOTHING;
