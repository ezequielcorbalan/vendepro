-- Migration 003: organizations, appraisals, appraisal_comparables
-- Run: npx wrangler d1 execute reportes-mg-db --file=migrations/003_organizations_appraisals_comparables.sql

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#ff007c',
  canva_template_id TEXT,
  canva_report_template_id TEXT,
  owner_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appraisals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  property_address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Buenos Aires',
  property_type TEXT NOT NULL DEFAULT 'departamento',
  covered_area REAL,
  total_area REAL,
  semi_area REAL,
  weighted_area REAL,
  strengths TEXT,
  weaknesses TEXT,
  opportunities TEXT,
  threats TEXT,
  publication_analysis TEXT,
  suggested_price REAL,
  test_price REAL,
  expected_close_price REAL,
  usd_per_m2 REAL,
  canva_design_id TEXT,
  canva_edit_url TEXT,
  agent_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appraisal_comparables (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  appraisal_id TEXT NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  zonaprop_url TEXT,
  address TEXT,
  total_area REAL,
  covered_area REAL,
  price REAL,
  usd_per_m2 REAL,
  days_on_market INTEGER,
  views_per_day REAL,
  age INTEGER,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_appraisals_agent ON appraisals(agent_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_org ON appraisals(org_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_comparables_appraisal ON appraisal_comparables(appraisal_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
