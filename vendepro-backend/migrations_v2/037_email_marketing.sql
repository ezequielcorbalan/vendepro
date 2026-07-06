-- ───────────────────────────────────────────────────────────────
-- 037_email_marketing.sql — Base de email marketing (Resend)
-- (036 reservada para meta_ad_account en branch charming-joliot)
-- Config de envío por org + lista de supresión (unsubscribes,
-- bounces, complaints). Fuente de verdad única: email_suppressions
-- (no hay columna opt_out duplicada en contacts/leads).
-- Idempotente: usa CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_settings (
  org_id TEXT PRIMARY KEY,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  enabled INTEGER DEFAULT 0,
  -- Verificación de dominio en Resend (una cuenta plataforma,
  -- un dominio verificado por org para white-label).
  resend_domain_id TEXT,
  domain_status TEXT DEFAULT 'unverified',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_suppressions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  -- unsubscribe | bounce | complaint | manual
  reason TEXT NOT NULL DEFAULT 'unsubscribe',
  -- origen del alta: link de baja, webhook resend, carga manual
  source TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_org ON email_suppressions(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_unique ON email_suppressions(org_id, email);
