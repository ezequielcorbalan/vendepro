-- ───────────────────────────────────────────────────────────────
-- 019_whatsapp_bot.sql — Configuración WhatsApp Business API
-- (Callbell) y estado de conversaciones del bot de calificación.
-- ───────────────────────────────────────────────────────────────

-- Configuración WhatsApp por organización
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'callbell',
  api_token_encrypted TEXT,
  webhook_secret TEXT,
  welcome_template TEXT NOT NULL DEFAULT 'Hola {{name}}! Gracias por contactarnos. ¿Estás buscando comprar/alquilar o querés vender/tasar una propiedad?',
  bot_enabled INTEGER NOT NULL DEFAULT 1,
  notify_agent_email INTEGER NOT NULL DEFAULT 1,
  notify_admin_email INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_org ON whatsapp_config(org_id);

-- Estado de conversaciones del bot de calificación
CREATE TABLE IF NOT EXISTS bot_conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_id TEXT,
  phone TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'welcome',
  answers TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_phone ON bot_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_bot_conv_lead ON bot_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_bot_conv_org_status ON bot_conversations(org_id, status);
