-- 012_property_visit_forms.sql
-- Ficha de Visita: cuestionario que llena el comprador/visitante DESPUÉS
-- de visitar una propiedad. Distinto de la Ficha de Tasación (la llena el agente).
--
-- Flujo: agente genera un link público único → se lo manda al visitante →
-- visitante abre /v/<slug> y completa el formulario → queda linkeado a la propiedad.
--
-- Nota: existe también la tabla `visit_forms` (008_) que implementa un modelo
-- de formularios-plantilla con respuestas dinámicas; no se reutiliza porque
-- este caso de uso requiere un schema fijo y denormalizado para reportes.

CREATE TABLE IF NOT EXISTS property_visit_forms (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  liked TEXT,
  disliked TEXT,
  subjective_price_usd REAL,
  buy_intention TEXT,
  observations TEXT,
  submitted_at TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_visit_forms_property ON property_visit_forms(property_id);
CREATE INDEX IF NOT EXISTS idx_property_visit_forms_org ON property_visit_forms(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_visit_forms_slug ON property_visit_forms(slug);
