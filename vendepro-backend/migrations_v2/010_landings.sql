-- 010_landings.sql
-- Tablas para el feature de Landings con IA.
-- Las consume api-crm (/landings), api-ai (/landings/:id/edit-block) y api-public (/l/:fullSlug).

CREATE TABLE IF NOT EXISTS landing_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT,                        -- NULL = global, disponible para todas las orgs
  name TEXT NOT NULL,
  kind TEXT NOT NULL,                 -- 'lead_capture' | 'property'
  description TEXT,
  preview_image_url TEXT,
  blocks_json TEXT NOT NULL,          -- JSON seed de bloques
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_templates_org ON landing_templates(org_id, active, sort_order);

CREATE TABLE IF NOT EXISTS landings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES landing_templates(id),
  kind TEXT NOT NULL,                 -- 'lead_capture' | 'property'
  slug_base TEXT NOT NULL,
  slug_suffix TEXT NOT NULL,
  full_slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft'|'pending_review'|'published'|'archived'
  blocks_json TEXT NOT NULL,
  brand_voice TEXT,
  lead_rules_json TEXT,
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  published_version_id TEXT,
  published_at TEXT,
  published_by TEXT,
  last_review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landings_org ON landings(org_id, status);
CREATE INDEX IF NOT EXISTS idx_landings_agent ON landings(org_id, agent_id);

CREATE TABLE IF NOT EXISTS landing_versions (
  id TEXT PRIMARY KEY,
  landing_id TEXT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blocks_json TEXT NOT NULL,
  label TEXT NOT NULL,                -- 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_versions_landing ON landing_versions(landing_id, version_number DESC);

CREATE TABLE IF NOT EXISTS landing_events (
  id TEXT PRIMARY KEY,
  landing_id TEXT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                 -- denormalizado para query rápida
  event_type TEXT NOT NULL,           -- 'pageview'|'cta_click'|'form_start'|'form_submit'
  visitor_id TEXT,
  session_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_landing_events_landing ON landing_events(landing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_landing_events_visitor ON landing_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_landing_events_slug_type ON landing_events(slug, event_type);
