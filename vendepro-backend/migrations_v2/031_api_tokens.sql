-- API Tokens de integración: JWT de larga vida (sin exp), revocables vía is_active.
-- Habilitan la API pública /v1/* (ej. importación de leads) securizada por Bearer JWT.
-- El valor del token NO se guarda: solo metadata + un prefijo enmascarado para la UI.

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT 'leads:write',   -- CSV de scopes, ej "leads:write"
  prefix TEXT,                                   -- enmascarado para identificar en la UI
  created_by TEXT,                               -- userId que lo creó
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_org ON api_tokens(org_id);
