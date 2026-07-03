-- Webhooks salientes: VendéPro avisa a sistemas externos (n8n, Zapier) cuando
-- ocurren eventos del CRM. Reemplaza el rol "disparador" que cumplía emBlue.
-- Cada entrega es un POST JSON firmado con HMAC-SHA256 del secret
-- (header X-VendePro-Signature: sha256=<hex>).

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT,                                     -- para reconocerlo en la UI, ej "n8n prod"
  url TEXT NOT NULL,
  secret TEXT NOT NULL,                          -- firma HMAC de cada entrega
  events TEXT NOT NULL,                          -- CSV: "lead.created,lead.stage_changed"
  is_active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(org_id);

-- Log de entregas (como el event-log de marketing).
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  event TEXT NOT NULL,
  status TEXT NOT NULL,                          -- 'success' | 'failed'
  http_status INTEGER,                           -- NULL si hubo timeout/error de red
  attempts INTEGER NOT NULL DEFAULT 1,           -- 1 o 2 (1 retry ante 5xx/timeout)
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(org_id, created_at);
