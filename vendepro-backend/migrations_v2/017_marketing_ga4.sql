-- ───────────────────────────────────────────────────────────────
-- 017_marketing_ga4.sql — GA4 Measurement Protocol + multi-provider log
-- Idempotente: ALTER TABLE ADD COLUMN en SQLite falla si la columna
-- ya existe, por lo que envolvemos cada ALTER en un bloque tolerante
-- emulado con SELECT desde pragma_table_info.
-- ───────────────────────────────────────────────────────────────

-- meta_integration: campos GA4 (Measurement Protocol server-side)
ALTER TABLE meta_integration ADD COLUMN ga4_measurement_id TEXT;
ALTER TABLE meta_integration ADD COLUMN ga4_api_secret_encrypted TEXT;
ALTER TABLE meta_integration ADD COLUMN ga4_enabled INTEGER DEFAULT 0;

-- stage_event_mappings: nombre de evento GA4 (opcional; si null, no se envía a GA4)
ALTER TABLE stage_event_mappings ADD COLUMN ga4_event_name TEXT;

-- meta_event_log: provider + entidad genérica (no sólo leads)
ALTER TABLE meta_event_log ADD COLUMN provider TEXT NOT NULL DEFAULT 'meta';
ALTER TABLE meta_event_log ADD COLUMN entity_type TEXT;
ALTER TABLE meta_event_log ADD COLUMN entity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_meta_log_provider ON meta_event_log(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_meta_log_entity ON meta_event_log(org_id, entity_type, entity_id);
