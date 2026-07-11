-- 039_buyer_pipeline_lead_properties.sql
-- Pipeline de leads compradores + vínculo M:N lead ↔ propiedad (local-first).
--
-- - leads.pipeline: discriminador 'vendedor' | 'comprador'. Validado en dominio
--   (sin CHECK, para poder sumar pipelines sin migración).
-- - lead_properties: propiedades de interés de un lead comprador. Siempre
--   referencia propiedades LOCALES: las publicadas en KiteProp se importan a
--   `properties` la primera vez que alguien consulta por ellas.
-- - property_links: mapeo genérico propiedad local ↔ aviso externo. Hoy lo
--   escribe el sync de KiteProp; cuando VendéPro publique a portales, el
--   publicador escribe acá los ids de aviso por provider ('zonaprop', ...).
-- - property_visit_forms.lead_id: la ficha de visita generada desde un lead
--   comprador vuelca su feedback en la relación lead_properties.
-- - properties.source: 'manual' (cargada en VendéPro) | 'kiteprop' (importada).

ALTER TABLE leads ADD COLUMN pipeline TEXT NOT NULL DEFAULT 'vendedor';

CREATE INDEX IF NOT EXISTS idx_leads_org_pipeline_stage ON leads(org_id, pipeline, stage);

CREATE TABLE IF NOT EXISTS lead_properties (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  -- 'interesado' | 'visita_agendada' | 'visitada' | 'descartada' | 'oferto'
  status TEXT NOT NULL DEFAULT 'interesado',
  notes TEXT,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_lead_properties_lead ON lead_properties(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_properties_org_property ON lead_properties(org_id, property_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_properties_lead_property ON lead_properties(lead_id, property_id);

CREATE TABLE IF NOT EXISTS property_links (
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  external_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_property_links_property ON property_links(org_id, property_id);

ALTER TABLE property_visit_forms ADD COLUMN lead_id TEXT;
CREATE INDEX IF NOT EXISTS idx_property_visit_forms_lead ON property_visit_forms(lead_id);

ALTER TABLE properties ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
