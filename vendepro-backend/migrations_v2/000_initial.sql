-- ============================================================
-- vendepro-db — Schema inicial completo
-- Base hexagonal: CRM inmobiliario + reportes
-- ============================================================

-- ============================================================
-- Core: Organizations & Users
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

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Seed: organización base
INSERT OR IGNORE INTO organizations (id, name, slug) VALUES ('org_mg', 'Marcela Genta Operaciones Inmobiliarias', 'marcela-genta');

-- ============================================================
-- CRM: Leads
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL DEFAULT 'otro',
  source_detail TEXT,
  property_address TEXT,
  neighborhood TEXT,
  property_type TEXT,
  operation TEXT NOT NULL DEFAULT 'venta',
  stage TEXT NOT NULL DEFAULT 'nuevo',
  assigned_to TEXT REFERENCES users(id),
  notes TEXT,
  estimated_value REAL,
  budget TEXT,
  timing TEXT,
  personas_trabajo TEXT,
  mascotas TEXT,
  next_step TEXT,
  next_step_date TEXT,
  lost_reason TEXT,
  first_contact_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

-- ============================================================
-- CRM: Contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  contact_type TEXT NOT NULL DEFAULT 'propietario',
  neighborhood TEXT,
  notes TEXT,
  source TEXT,
  agent_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_agent ON contacts(agent_id);

-- ============================================================
-- CRM: Stage History
-- ============================================================

CREATE TABLE IF NOT EXISTS stage_history (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id),
  notes TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stage_history_entity ON stage_history(entity_type, entity_id);

-- ============================================================
-- CRM: Activities
-- ============================================================

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL,
  description TEXT,
  result TEXT,
  duration_minutes INTEGER,
  lead_id TEXT REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  property_id TEXT,
  appraisal_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_agent ON activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);

-- ============================================================
-- CRM: Calendar Events
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  lead_id TEXT REFERENCES leads(id),
  contact_id TEXT REFERENCES contacts(id),
  property_id TEXT,
  appraisal_id TEXT,
  reservation_id TEXT,
  color TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_calendar_org ON calendar_events(org_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_agent ON calendar_events(agent_id);

-- ============================================================
-- CRM: Reservations
-- ============================================================

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_address TEXT,
  buyer_name TEXT,
  seller_name TEXT,
  agent_id TEXT NOT NULL REFERENCES users(id),
  offer_amount REAL,
  offer_currency TEXT NOT NULL DEFAULT 'USD',
  reservation_date TEXT,
  stage TEXT NOT NULL DEFAULT 'reservada',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_org ON reservations(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_reservations_agent ON reservations(agent_id);

-- ============================================================
-- CRM: Agent Objectives
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_objectives (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES users(id),
  period_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  metric TEXT NOT NULL,
  target REAL NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_objectives_org ON agent_objectives(org_id, period_end);

-- ============================================================
-- Properties
-- ============================================================

CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL DEFAULT 'org_mg',
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
    CHECK (status IN ('active', 'sold', 'suspended', 'archived', 'inactive')),
  sold_price REAL,
  sold_date TEXT,
  days_on_market INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_slug ON properties(public_slug);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON properties(neighborhood);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

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

CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);

-- ============================================================
-- Appraisals (Tasaciones)
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

CREATE INDEX IF NOT EXISTS idx_appraisals_agent ON appraisals(agent_id);
CREATE INDEX IF NOT EXISTS idx_appraisals_org ON appraisals(org_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_comparables_appraisal ON appraisal_comparables(appraisal_id);

-- ============================================================
-- Fichas de Tasación
-- ============================================================

CREATE TABLE IF NOT EXISTS fichas_tasacion (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  agent_id TEXT NOT NULL REFERENCES users(id),
  lead_id TEXT,
  appraisal_id TEXT,
  inspection_date TEXT,
  address TEXT NOT NULL,
  neighborhood TEXT,
  property_type TEXT,
  floor_number TEXT,
  elevators TEXT,
  age TEXT,
  building_category TEXT,
  property_condition TEXT,
  covered_area REAL,
  semi_area REAL,
  uncovered_area REAL,
  m2_value_neighborhood REAL,
  m2_value_zone REAL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  storage_rooms INTEGER,
  parking_spots INTEGER,
  air_conditioning INTEGER,
  bedroom_dimensions TEXT,
  living_dimensions TEXT,
  kitchen_dimensions TEXT,
  bathroom_dimensions TEXT,
  floor_type TEXT,
  disposition TEXT,
  orientation TEXT,
  balcony_type TEXT,
  heating_type TEXT,
  noise_level TEXT,
  amenities TEXT,
  is_professional INTEGER DEFAULT 0,
  is_occupied INTEGER DEFAULT 0,
  is_credit_eligible INTEGER DEFAULT 0,
  sells_to_buy INTEGER DEFAULT 0,
  expenses REAL,
  abl REAL,
  aysa REAL,
  notes TEXT,
  photos TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fichas_agent ON fichas_tasacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_fichas_lead ON fichas_tasacion(lead_id);

-- ============================================================
-- Prefactibilidades
-- ============================================================

CREATE TABLE IF NOT EXISTS prefactibilidades (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  agent_id TEXT NOT NULL REFERENCES users(id),
  lead_id TEXT,
  public_slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent')),
  address TEXT NOT NULL,
  neighborhood TEXT,
  city TEXT DEFAULT 'Buenos Aires',
  lot_area REAL,
  lot_frontage REAL,
  lot_depth REAL,
  zoning TEXT,
  fot REAL,
  fos REAL,
  max_height TEXT,
  lot_price REAL,
  lot_price_per_m2 REAL,
  lot_description TEXT,
  lot_photos TEXT,
  project_name TEXT,
  project_description TEXT,
  buildable_area REAL,
  total_units INTEGER,
  units_mix TEXT,
  parking_spots INTEGER,
  amenities TEXT,
  project_renders TEXT,
  construction_cost_per_m2 REAL,
  total_construction_cost REAL,
  professional_fees REAL,
  permits_cost REAL,
  commercialization_cost REAL,
  other_costs REAL,
  total_investment REAL,
  avg_sale_price_per_m2 REAL,
  total_sellable_area REAL,
  projected_revenue REAL,
  gross_margin REAL,
  margin_pct REAL,
  tir REAL,
  payback_months INTEGER,
  comparables TEXT,
  timeline TEXT,
  executive_summary TEXT,
  recommendation TEXT,
  video_url TEXT,
  agent_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prefact_org ON prefactibilidades(org_id);
CREATE INDEX IF NOT EXISTS idx_prefact_agent ON prefactibilidades(agent_id);
CREATE INDEX IF NOT EXISTS idx_prefact_slug ON prefactibilidades(public_slug);

-- ============================================================
-- Tasacion Template Blocks
-- ============================================================

CREATE TABLE IF NOT EXISTS tasacion_template_blocks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'service' CHECK (block_type IN ('service', 'video', 'stats', 'text', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  number_label TEXT,
  video_url TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  section TEXT NOT NULL DEFAULT 'commercial' CHECK (section IN ('commercial', 'conditions')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_template_blocks_org ON tasacion_template_blocks(org_id, section, sort_order);

-- ============================================================
-- Tags
-- ============================================================

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

-- Seed: tags por defecto
INSERT OR IGNORE INTO tags (id, org_id, name, color, is_default) VALUES
('tag_propietario', 'org_mg', 'Propietario', '#ec4899', 1),
('tag_comprador', 'org_mg', 'Comprador', '#3b82f6', 1),
('tag_inversor', 'org_mg', 'Inversor', '#f59e0b', 1),
('tag_aliado', 'org_mg', 'Aliado', '#10b981', 1);

-- ============================================================
-- Reports (legacy — portales de propiedades)
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_reports_property ON reports(property_id);
CREATE INDEX IF NOT EXISTS idx_report_metrics_report ON report_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_report_content_report ON report_content(report_id);
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);
CREATE INDEX IF NOT EXISTS idx_competitor_links_property ON competitor_links(property_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
