-- ───────────────────────────────────────────────────────────────
-- 035_user_integrations_google.sql
-- Integraciones por USUARIO (Google Calendar): cada agente conecta su
-- propia cuenta vía OAuth; tokens cifrados. Además, columnas de espejo
-- en calendar_events para vincular el evento local con el de Google
-- y registrar cuándo se envió la invitación al cliente.
-- Los ALTER TABLE no son idempotentes: esta migración corre una sola vez.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  credentials_encrypted TEXT,
  config_json TEXT,
  enabled INTEGER DEFAULT 0,
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_org ON user_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider, enabled);

ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT;
ALTER TABLE calendar_events ADD COLUMN invite_sent_at TEXT;
