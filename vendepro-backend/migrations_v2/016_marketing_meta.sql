-- ───────────────────────────────────────────────────────────────
-- 016_marketing_meta.sql — Integración Meta Conversion API
-- Idempotente: usa CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_integration (
  org_id TEXT PRIMARY KEY,
  pixel_id TEXT,
  access_token_encrypted TEXT,
  stape_endpoint TEXT,
  gtm_container_id TEXT,
  test_event_code TEXT,
  enabled INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stage_event_mappings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  meta_event_name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stage_mappings_org ON stage_event_mappings(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_mappings_unique ON stage_event_mappings(org_id, stage_key);

CREATE TABLE IF NOT EXISTS meta_event_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_id TEXT,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  response_code INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meta_log_org ON meta_event_log(org_id);
CREATE INDEX IF NOT EXISTS idx_meta_log_lead ON meta_event_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_meta_log_event_id ON meta_event_log(event_id);
