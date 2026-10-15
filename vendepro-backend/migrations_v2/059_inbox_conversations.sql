-- 059_inbox_conversations.sql
-- Inbox propio: conversaciones y mensajes de WhatsApp (y después Instagram/
-- Facebook, que usan el mismo modelo cambiando `channel`).
--
-- Contexto: hoy el inbox es Onetalk (Chatwoot de EMBLUE) y la agencia pierde
-- el acceso. El bot sigue viviendo en n8n: VendéPro guarda las conversaciones
-- y le avisa por webhook; no se reconstruye nada de la lógica del bot.
--
-- La semántica copia a Chatwoot a propósito (status open/pending/resolved,
-- direction in/out, labels): el bot ya habla ese idioma y así su migración es
-- cambiar URLs, no reescribir nodos.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  -- 'whatsapp' | 'instagram' | 'facebook'
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  -- Con quién se habla. Nullable: un número desconocido abre conversación
  -- igual y el contacto se crea o se vincula después.
  contact_id TEXT REFERENCES contacts(id),
  -- Lead al que corresponde la charla, si se pudo atar.
  lead_id TEXT REFERENCES leads(id),
  -- Id del chat en el proveedor: jid de WhatsApp, PSID de Messenger. Es la
  -- clave con la que se reconoce una conversación ya existente.
  external_id TEXT NOT NULL,
  -- 'open' | 'pending' | 'resolved'
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id TEXT REFERENCES users(id),
  -- Array JSON. 'bot_pausado' es la que usa n8n para dejar de responder.
  labels TEXT NOT NULL DEFAULT '[]',
  last_activity_at TEXT,
  -- Fin de la ventana de 24h de WhatsApp: pasada esa hora, la API oficial
  -- sólo deja mandar plantillas aprobadas. Se guarda desde el día uno aunque
  -- el proveedor actual no la exija, para que migrar a Cloud API no rompa la
  -- UI ni el flujo de los agentes.
  window_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Una conversación por chat y canal: es lo que hace idempotente la ingesta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_external
  ON conversations(org_id, channel, external_id);
-- La bandeja: abiertas primero, por actividad reciente.
CREATE INDEX IF NOT EXISTS idx_conversations_inbox
  ON conversations(org_id, status, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assignee ON conversations(org_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  -- 'in' (del cliente) | 'out' (nuestro). Equivale al message_type 0/1 de
  -- Chatwoot, que es lo que el bot de n8n espera recibir.
  direction TEXT NOT NULL,
  -- 'contact' | 'agent' | 'bot'
  sender_type TEXT NOT NULL,
  -- users(id) cuando lo escribió un agente desde la UI.
  sender_id TEXT REFERENCES users(id),
  content TEXT,
  -- Array JSON: [{ type, url, mime, filename }]
  attachments TEXT NOT NULL DEFAULT '[]',
  -- Id del mensaje en el proveedor. Un reenvío del webhook trae el mismo id,
  -- y el índice único de abajo evita que el mensaje entre dos veces.
  external_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
-- Idempotencia de la ingesta. Parcial: los mensajes salientes propios todavía
-- no tienen id del proveedor cuando se guardan.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external
  ON messages(org_id, external_id) WHERE external_id IS NOT NULL;
