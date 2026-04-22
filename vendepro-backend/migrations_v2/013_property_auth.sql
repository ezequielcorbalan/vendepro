-- 013_property_auth.sql
-- Autorización de venta: fecha de inicio + duración del mandato.
-- Campos sumados a properties para calcular vencimiento desde el frontend.
--
-- Idempotente vía run_alter_migration en start-local.sh (ignora "duplicate column").
--
-- Además creamos la tabla property_price_history para registrar ajustes de
-- precio manuales (con motivo). La tabla usa IF NOT EXISTS para ser idempotente.

ALTER TABLE properties ADD COLUMN auth_start_date TEXT;
ALTER TABLE properties ADD COLUMN auth_duration_days INTEGER DEFAULT 180;

CREATE TABLE IF NOT EXISTS property_price_history (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  price_usd REAL NOT NULL,
  previous_price_usd REAL,
  reason TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_property ON property_price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_price_history_org ON property_price_history(org_id);
