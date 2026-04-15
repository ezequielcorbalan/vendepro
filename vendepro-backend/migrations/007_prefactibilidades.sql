-- Prefactibilidades (estudios para lotes e inversores)
CREATE TABLE IF NOT EXISTS prefactibilidades (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  agent_id TEXT NOT NULL REFERENCES users(id),
  lead_id TEXT,
  public_slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent')),

  -- Datos del terreno
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
  lot_photos TEXT, -- JSON array

  -- Proyecto propuesto
  project_name TEXT,
  project_description TEXT,
  buildable_area REAL,
  total_units INTEGER,
  units_mix TEXT, -- JSON: [{type: 'monoambiente', count: 5, avg_m2: 35}, ...]
  parking_spots INTEGER,
  amenities TEXT, -- JSON array
  project_renders TEXT, -- JSON array de URLs

  -- Análisis económico
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

  -- Comparables (JSON array)
  comparables TEXT,

  -- Cronograma (JSON array de fases)
  timeline TEXT,

  -- Conclusión
  executive_summary TEXT,
  recommendation TEXT,

  -- Meta
  video_url TEXT,
  agent_notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prefact_org ON prefactibilidades(org_id);
CREATE INDEX IF NOT EXISTS idx_prefact_agent ON prefactibilidades(agent_id);
CREATE INDEX IF NOT EXISTS idx_prefact_slug ON prefactibilidades(public_slug);
