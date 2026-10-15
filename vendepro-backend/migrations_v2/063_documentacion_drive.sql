-- 063_documentacion_drive.sql
-- Barrido de la carpeta de Drive de cada propiedad → checklist de documentación.
-- Plan: doc/documentacion-drive-plan.md. Va DESPUÉS de la 061 (property_documents)
-- y de la 062.
--
-- VendéPro lee la unidad compartida de documentación con una credencial de
-- sólo lectura, reconoce cada archivo (por el nombre que le pone n8n o con IA)
-- y lo registra en property_documents con source = 'drive'. El checklist de la
-- propiedad y la fecha de la autorización se derivan de ahí.
--
-- La configuración (unidad compartida, carpetas a ignorar, modo sólo lectura)
-- vive en org_integrations con provider = 'google_drive_docs'.

-- Carpeta de propiedad en Drive ↔ propiedad de VendéPro.
CREATE TABLE IF NOT EXISTS drive_folders (
  folder_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  -- Nombre de la carpeta de área que la contiene (ej. "OFICINA PROPIEDADES").
  area TEXT,
  name TEXT NOT NULL,
  web_url TEXT,
  property_id TEXT REFERENCES properties(id),
  -- auto: matcheo por dirección · manual: la vinculó una persona (no se recalcula)
  -- ambiguous: más de una propiedad posible · none: ninguna · ignored: no es una propiedad
  match_status TEXT NOT NULL DEFAULT 'none'
    CHECK (match_status IN ('auto', 'manual', 'ambiguous', 'none', 'ignored')),
  last_scanned_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_org ON drive_folders(org_id, match_status);
CREATE INDEX IF NOT EXISTS idx_drive_folders_property ON drive_folders(property_id);

-- Fecha hasta la que sirve el documento (informes de dominio e inhibición: 30 días).
ALTER TABLE property_documents ADD COLUMN valid_until TEXT;
-- Lo que leyó la IA más allá del tipo: { authorization: { start_date, duration_days } }.
ALTER TABLE property_documents ADD COLUMN extracted_json TEXT;
-- 'nombre_n8n' | 'ia' | 'sin_leer' (muy grande o formato que no se lee).
ALTER TABLE property_documents ADD COLUMN classified_by TEXT;
-- modifiedTime de Drive: si cambia, el archivo se vuelve a leer.
ALTER TABLE property_documents ADD COLUMN drive_modified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_property_documents_valid_until
  ON property_documents(valid_until) WHERE valid_until IS NOT NULL;
