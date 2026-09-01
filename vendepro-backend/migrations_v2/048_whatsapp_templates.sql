-- ───────────────────────────────────────────────────────────────
-- 048_whatsapp_templates.sql
--
-- Mensajes predeterminados de WhatsApp, al estilo de las respuestas rápidas
-- de WhatsApp Business: el agente escribe una vez el texto y después, desde
-- cualquier botón de WhatsApp del CRM, lo elige de una lista en vez de
-- tipearlo. El texto viaja pre-cargado en el link wa.me.
--
-- Son de la org (no del usuario): la inmobiliaria define cómo se le habla al
-- cliente y todos los agentes usan el mismo guión.
--
-- El cuerpo admite variables {{nombre}}, {{agente}}, {{inmobiliaria}} y
-- {{direccion}}, que se reemplazan en el frontend con los datos del lead o
-- contacto desde el que se abre el chat.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Orden en el que aparecen en el selector; empates se desempatan por nombre.
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org
  ON whatsapp_templates(org_id, sort_order);

-- Semilla: tres mensajes que cubren el uso diario (primer contacto,
-- seguimiento, coordinar visita) para que la función sirva desde el minuto
-- cero. Ids derivados de la org → idempotente, y el agente puede editarlos o
-- borrarlos como cualquier otro.
INSERT OR IGNORE INTO whatsapp_templates (id, org_id, name, body, sort_order, is_active, created_at, updated_at)
SELECT
  'watpl-primer-contacto-' || o.id,
  o.id,
  'Primer contacto',
  'Hola {{nombre}}, ¿cómo estás? Te escribo de {{inmobiliaria}} por la consulta que nos dejaste. ¿Tenés unos minutos para que te llame y veamos cómo podemos ayudarte?',
  0, 1, datetime('now'), datetime('now')
FROM organizations o;

INSERT OR IGNORE INTO whatsapp_templates (id, org_id, name, body, sort_order, is_active, created_at, updated_at)
SELECT
  'watpl-seguimiento-' || o.id,
  o.id,
  'Seguimiento',
  'Hola {{nombre}}, ¿cómo va todo? Te escribo para retomar nuestra charla y saber si seguís interesado. Cualquier duda quedo a disposición. {{agente}} — {{inmobiliaria}}',
  1, 1, datetime('now'), datetime('now')
FROM organizations o;

INSERT OR IGNORE INTO whatsapp_templates (id, org_id, name, body, sort_order, is_active, created_at, updated_at)
SELECT
  'watpl-coordinar-visita-' || o.id,
  o.id,
  'Coordinar visita',
  'Hola {{nombre}}, soy {{agente}} de {{inmobiliaria}}. ¿Coordinamos una visita a {{direccion}}? Decime qué día y horario te viene bien y lo agendo.',
  2, 1, datetime('now'), datetime('now')
FROM organizations o;
