-- ───────────────────────────────────────────────────────────────
-- 034_org_integrations.sql
-- Integraciones con CRMs externos (KiteProp y futuros providers):
-- credenciales cifradas por org, mapping de ids externos y log de syncs
-- Idempotente
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT,
  credentials_encrypted TEXT,
  config_json TEXT,
  enabled INTEGER DEFAULT 0,
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_org_integrations_org ON org_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_provider ON org_integrations(provider, enabled);

CREATE TABLE IF NOT EXISTS integration_links (
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_links_contact ON integration_links(contact_id);

CREATE TABLE IF NOT EXISTS integration_sync_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  contacts_created INTEGER DEFAULT 0,
  contacts_skipped INTEGER DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_org ON integration_sync_log(org_id, started_at DESC);
