-- 006_reports_add_org_id.sql
-- reports no tiene org_id, lo cual impide scoping multi-tenant.
-- Agrega columna nullable, backfill desde properties (JOIN), luego la dejamos
-- nullable para no romper si se crea un report huérfano (CHECK desde app layer).

ALTER TABLE reports ADD COLUMN org_id TEXT;

UPDATE reports
SET org_id = (SELECT p.org_id FROM properties p WHERE p.id = reports.property_id)
WHERE org_id IS NULL;

-- Índice para consultas scoped por org
CREATE INDEX IF NOT EXISTS idx_reports_org_id ON reports(org_id);
