-- Ficha de tasación digital (inspección de propiedad)
CREATE TABLE IF NOT EXISTS fichas_tasacion (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  agent_id TEXT NOT NULL REFERENCES users(id),
  lead_id TEXT,
  appraisal_id TEXT,

  -- Datos generales
  inspection_date TEXT,
  address TEXT NOT NULL,
  neighborhood TEXT,
  property_type TEXT, -- departamento, ph, casa
  floor_number TEXT,
  elevators TEXT,
  age TEXT,
  building_category TEXT, -- excelente, bueno, regular
  property_condition TEXT, -- muy_bueno, regular, a_refaccionar

  -- Superficies y valores
  covered_area REAL,
  semi_area REAL,
  uncovered_area REAL,
  m2_value_neighborhood REAL,
  m2_value_zone REAL,

  -- Ambientes
  bedrooms INTEGER,
  bathrooms INTEGER,
  storage_rooms INTEGER,
  parking_spots INTEGER,
  air_conditioning INTEGER,

  -- Medidas
  bedroom_dimensions TEXT,
  living_dimensions TEXT,
  kitchen_dimensions TEXT,
  bathroom_dimensions TEXT,

  -- Características (JSON arrays de strings)
  floor_type TEXT, -- parquet, ceramicos, alfombra, otro
  disposition TEXT, -- frente, contrafrente, lateral_interno
  orientation TEXT, -- JSON: {norte: "", sur: "", este: "", oeste: ""}
  balcony_type TEXT, -- frances, tradicional, corrido, aterrazado, terraza
  heating_type TEXT, -- radiadores, losa_radiante, otro
  noise_level TEXT, -- silencioso, promedio, ruidoso
  amenities TEXT, -- JSON array: ["pileta", "laundry", "sum", "vigilancia"]

  -- Booleanos
  is_professional INTEGER DEFAULT 0,
  is_occupied INTEGER DEFAULT 0,
  is_credit_eligible INTEGER DEFAULT 0,
  sells_to_buy INTEGER DEFAULT 0,

  -- Gastos
  expenses REAL,
  abl REAL,
  aysa REAL,

  -- Notas y fotos
  notes TEXT,
  photos TEXT, -- JSON array de URLs

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fichas_agent ON fichas_tasacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_fichas_lead ON fichas_tasacion(lead_id);
