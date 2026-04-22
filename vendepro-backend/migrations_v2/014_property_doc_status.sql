-- 014_property_doc_status.sql
-- Checklist de documentación con 3 estados por ítem.
-- Persistimos un JSON { [docKey]: 'done' | 'na' | 'pending' } en doc_status_json.
--
-- Idempotente vía run_alter_migration en start-local.sh.

ALTER TABLE properties ADD COLUMN doc_status_json TEXT;
