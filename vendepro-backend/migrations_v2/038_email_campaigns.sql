-- ───────────────────────────────────────────────────────────────
-- 038_email_campaigns.sql — Campañas de email marketing (Fase 3)
-- Campañas con segmento dinámico (JSON) + 1 fila por destinatario
-- en email_campaign_sends (cola de envío procesada por cron/batch).
-- Idempotente: usa CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  preheader TEXT,
  html TEXT,
  text TEXT,
  -- Criterio de audiencia (JSON): se resuelve al encolar, no es lista congelada
  segment_json TEXT,
  -- draft | scheduled | sending | sent | cancelled
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by TEXT,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_org ON email_campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);

CREATE TABLE IF NOT EXISTS email_campaign_sends (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  contact_id TEXT,
  lead_id TEXT,
  -- pending | sent | failed
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error TEXT,
  resend_email_id TEXT,
  sent_at TEXT,
  -- Tracking (Fase 4 — webhooks de Resend)
  opened_at TEXT,
  clicked_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON email_campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_org ON email_campaign_sends(org_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON email_campaign_sends(campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_sends_unique ON email_campaign_sends(campaign_id, email);
