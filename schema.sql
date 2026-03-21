-- ============================================================
-- Reportes App - D1 Schema (SQLite)
-- Run: npx wrangler d1 execute reportes-mg-db --file=schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  address TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Buenos Aires',
  property_type TEXT NOT NULL DEFAULT 'departamento'
    CHECK (property_type IN ('departamento', 'casa', 'ph', 'local', 'terreno', 'oficina')),
  rooms INTEGER,
  size_m2 REAL,
  asking_price REAL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'ARS')),
  owner_name TEXT NOT NULL,
  owner_phone TEXT,
  owner_email TEXT,
  public_slug TEXT UNIQUE NOT NULL,
  cover_photo TEXT,
  agent_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'sold', 'suspended', 'archived')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS report_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'zonaprop'
    CHECK (source IN ('zonaprop', 'argenprop', 'mercadolibre', 'manual')),
  impressions INTEGER,
  portal_visits INTEGER,
  inquiries INTEGER,
  phone_calls INTEGER,
  whatsapp INTEGER,
  in_person_visits INTEGER,
  offers INTEGER,
  ranking_position INTEGER,
  avg_market_price REAL,
  screenshot_url TEXT,
  extracted_at TEXT
);

CREATE TABLE IF NOT EXISTS report_content (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section TEXT NOT NULL
    CHECK (section IN ('strategy', 'marketing', 'conclusion', 'benchmarks', 'price_reference')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS report_photos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT NOT NULL DEFAULT 'visit_form'
    CHECK (photo_type IN ('visit_form', 'property', 'screenshot')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS competitor_links (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  address TEXT,
  price REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Multi-tenant: Organizations
-- ============================================================

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

-- ============================================================
-- Tasaciones (Appraisals)
-- ============================================================

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

-- ============================================================
-- Price History
-- ============================================================

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  price REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  changed_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(public_slug);
CREATE INDEX IF NOT EXISTS idx_reports_property ON reports(property_id);
CREATE INDEX IF NOT EXISTS idx_report_metrics_report ON report_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_report_content_report ON report_content(report_id);
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_competitor_links_property ON competitor_links(property_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_agent ON appraisals(agent_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_org ON appraisals(org_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_comparables_appraisal ON appraisal_comparables(appraisal_id);
CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
