-- vendepro-backend/migrations_v2/048_agent_profiles.sql
-- Perfil público del agente. 1:1 con users, tabla aparte para no mezclar
-- identidad/auth con datos de marketing. La consume api-admin (edición) y
-- api-public (GET /a/:orgSlug/:agentSlug).

CREATE TABLE IF NOT EXISTS agent_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  headline TEXT,               -- "Coordinador Comercial", "Martillera y Corredora"
  bio TEXT,
  license TEXT,                -- matrícula, ej "CUCICBA 3906"
  years_experience INTEGER,
  zones_json TEXT,             -- ["Villa Urquiza","Saavedra"]
  specialties_json TEXT,       -- ["Residencial","Venta"]
  whatsapp TEXT,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  linkedin TEXT,
  website TEXT,
  cover_image_url TEXT,
  stats_json TEXT,             -- [{"label":"Seguidores TikTok","value":"170.000"}]
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_profiles_org_slug
  ON agent_profiles(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_org
  ON agent_profiles(org_id, is_public);
