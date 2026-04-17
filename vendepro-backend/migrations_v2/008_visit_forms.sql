-- 008_visit_forms.sql
-- Formularios públicos de visitas y sus respuestas.
-- Los consume api-public /visit-form/:slug (GET y POST).

CREATE TABLE IF NOT EXISTS visit_forms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  public_slug TEXT UNIQUE NOT NULL,
  fields TEXT NOT NULL,  -- JSON array de VisitFormField
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visit_forms_property_id ON visit_forms(property_id);

CREATE TABLE IF NOT EXISTS visit_form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES visit_forms(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  visitor_email TEXT,
  responses TEXT NOT NULL,  -- JSON object
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visit_form_responses_form_id ON visit_form_responses(form_id);
