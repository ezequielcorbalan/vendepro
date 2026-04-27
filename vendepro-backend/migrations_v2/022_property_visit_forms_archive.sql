-- 022_property_visit_forms_archive.sql
-- Soft-archive y soft-delete para fichas de visita.
--
-- archived_at: el agente la oculta del listado activo y del reporte al
--              propietario, pero queda recuperable.
-- deleted_at:  borrado lógico (no se muestra en ningún lado, salvo admin).
--
-- Las fichas con archived_at o deleted_at != NULL no se incluyen
-- automáticamente en el reporte del propietario.

ALTER TABLE property_visit_forms ADD COLUMN archived_at TEXT;
ALTER TABLE property_visit_forms ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_property_visit_forms_archived
  ON property_visit_forms(property_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_property_visit_forms_deleted
  ON property_visit_forms(property_id, deleted_at);
