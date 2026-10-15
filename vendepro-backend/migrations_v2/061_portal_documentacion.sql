-- 061_portal_documentacion.sql
-- Portal de documentación del propietario (/d/<token>).
--
-- El agente genera desde la ficha de la propiedad un link que le manda al
-- dueño. El dueño ve qué le falta y sube los archivos; api-public los reenvía
-- tal cual al webhook de n8n que ya los guarda en Drive, los clasifica con IA
-- y lleva la planilla de registro. Acá queda el espejo en D1 de lo recibido,
-- que es lo que alimenta el checklist de la propiedad.
--
-- La URL de n8n y el mapa de agentes viven en org_integrations
-- (provider = 'docs_n8n'), no en el código: nada de esto es de una sola org.

CREATE TABLE IF NOT EXISTS doc_portal_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id),
  -- Quién generó el link.
  agent_id TEXT REFERENCES users(id),
  -- 32 hex aleatorios: el link es la única credencial del propietario.
  token TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('venta', 'alquiler')),
  -- Tipos que entiende el checklist de n8n (no los de properties.property_type).
  property_kind TEXT NOT NULL CHECK (property_kind IN ('depto', 'ph', 'casa', 'local', 'otro')),
  -- 'nose' = el propietario no sabe: los papeles de sucesión quedan opcionales.
  succession TEXT NOT NULL DEFAULT 'no' CHECK (succession IN ('si', 'no', 'nose')),
  -- NULL = no se sabe. Casado → el certificado de matrimonio pasa a requerido.
  married INTEGER,
  -- `sid` que se le pasa a n8n: agrupa los archivos en un mismo resumen.
  session_id TEXT NOT NULL,
  files_count INTEGER NOT NULL DEFAULT 0,
  last_upload_at TEXT,
  -- Último aviso de "ya mandé todo" a n8n (para no mandar dos resúmenes seguidos).
  last_finished_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_portal_links_token ON doc_portal_links(token);
-- Un solo link vivo por propiedad: regenerar revoca el anterior.
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_portal_links_active
  ON doc_portal_links(property_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doc_portal_links_org ON doc_portal_links(org_id);

-- Un registro por archivo recibido (espejo de la planilla de n8n).
CREATE TABLE IF NOT EXISTS property_documents (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id),
  -- NULL cuando entra por otra vía que no es el portal (fase 2: mail).
  link_id TEXT REFERENCES doc_portal_links(id),
  source TEXT NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'email')),
  original_name TEXT NOT NULL,
  -- tipo_id de n8n: titulo, dni, abl, ... u 'otro' si la IA no lo reconoció.
  doc_type TEXT NOT NULL DEFAULT 'otro',
  recognized INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT,
  drive_file_id TEXT,
  drive_file_url TEXT,
  drive_folder_url TEXT,
  observations TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id, created_at);
CREATE INDEX IF NOT EXISTS idx_property_documents_link ON property_documents(link_id, created_at);
-- Idempotencia: el mismo archivo de Drive no se registra dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_documents_drive
  ON property_documents(drive_file_id) WHERE drive_file_id IS NOT NULL;
