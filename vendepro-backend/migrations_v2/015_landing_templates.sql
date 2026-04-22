-- 015_landing_templates.sql
-- Marca una landing como plantilla reutilizable (NULL = landing normal,
-- 'tasacion' = plantilla de tasación). El registro queda en la misma tabla
-- `landings` para reusar todo el editor de bloques. Cuando se clona la
-- plantilla en una tasación concreta, guardamos el id de la plantilla en
-- `appraisals.template_landing_id` para trazabilidad.

ALTER TABLE landings ADD COLUMN template_type TEXT;
ALTER TABLE appraisals ADD COLUMN template_landing_id TEXT;

CREATE INDEX IF NOT EXISTS idx_landings_template_type ON landings(template_type);
CREATE INDEX IF NOT EXISTS idx_appraisals_template ON appraisals(template_landing_id);
