-- 004_properties_add_columns.sql
-- Agrega columnas que los workers usan pero que no están en migraciones v2:
--   - lead_id: FK a leads (para propiedades originadas desde un lead)
--   - operation_type: 'venta' | 'alquiler' (string legacy)
--   - operation_type_id: FK a operation_types (catalog normalizado, nuevo en 005)
--   - commercial_stage_id: FK a commercial_stages
--   - status_id: FK a property_statuses
--   - last_external_report_at: timestamp del último reporte externo cargado

ALTER TABLE properties ADD COLUMN lead_id TEXT REFERENCES leads(id);
ALTER TABLE properties ADD COLUMN operation_type TEXT DEFAULT 'venta';
ALTER TABLE properties ADD COLUMN operation_type_id INTEGER;
ALTER TABLE properties ADD COLUMN commercial_stage_id INTEGER;
ALTER TABLE properties ADD COLUMN status_id INTEGER;
ALTER TABLE properties ADD COLUMN last_external_report_at TEXT;

-- Backfill operation_type existente a 'venta' para filas actuales
UPDATE properties SET operation_type = 'venta' WHERE operation_type IS NULL;
