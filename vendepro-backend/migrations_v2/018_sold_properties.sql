-- ───────────────────────────────────────────────────────────────
-- 018_sold_properties.sql — Base de propiedades vendidas para
-- usar como cierres reales en tasaciones. Pueden ser propias del
-- equipo o de colegas externos. Preparada para Fase 3 (red entre
-- inmobiliarias) vía la columna shared_with_network.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sold_properties (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,

  -- Características básicas
  property_type TEXT NOT NULL,
  neighborhood TEXT,
  address_approx TEXT,                   -- ej "Ladines al 2400"
  covered_area REAL,
  total_area REAL,
  semi_area REAL,
  rooms INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking INTEGER,

  -- Precios (siempre USD)
  listing_price_usd REAL,
  closing_price_usd REAL,
  closed_at TEXT,                        -- fecha de cierre (ISO)

  notes TEXT,

  -- Origen
  agent_id TEXT,                         -- FK a users si la vendió alguien del equipo
  external_agent_name TEXT,              -- nombre del colega externo (si aplica)
  external_agency TEXT,                  -- inmobiliaria del colega (si aplica)

  -- Fotos como JSON array de URLs R2
  photos_json TEXT DEFAULT '[]',

  -- Preparado para Fase 3 — red compartida entre orgs
  shared_with_network INTEGER DEFAULT 0,

  created_by TEXT,                       -- user que cargó el registro
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sold_props_org ON sold_properties(org_id);
CREATE INDEX IF NOT EXISTS idx_sold_props_agent ON sold_properties(org_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_sold_props_type_hood ON sold_properties(org_id, property_type, neighborhood);
CREATE INDEX IF NOT EXISTS idx_sold_props_closed ON sold_properties(org_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_sold_props_shared ON sold_properties(shared_with_network) WHERE shared_with_network = 1;
