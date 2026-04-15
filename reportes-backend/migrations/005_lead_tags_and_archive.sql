-- Tags system for leads/contacts
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(org_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag ON lead_tags(tag_id);

-- Default tags
INSERT INTO tags (id, org_id, name, color, is_default) VALUES
('tag_propietario', 'org_mg', 'Propietario', '#ec4899', 1),
('tag_comprador', 'org_mg', 'Comprador', '#3b82f6', 1),
('tag_inversor', 'org_mg', 'Inversor', '#f59e0b', 1),
('tag_aliado', 'org_mg', 'Aliado', '#10b981', 1);
