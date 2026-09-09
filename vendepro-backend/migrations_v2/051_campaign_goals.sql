-- ───────────────────────────────────────────────────────────────
-- 051_campaign_goals.sql
--
-- A qué objetivo comercial apunta cada campaña de pauta: conseguir
-- propietarios (captación) o compradores para una publicación (demanda).
--
-- Meta no lo sabe: su `objective` dice cómo optimiza (OUTCOME_LEADS,
-- OUTCOME_TRAFFIC…), no para qué la usa la inmobiliaria. Las dos cosas son
-- campañas de leads. Así que lo etiqueta el usuario, una vez por campaña.
--
-- Se guarda contra el `campaign_id` del proveedor y NO contra el nombre, por
-- tres razones: renombrar en Ads Manager no rompe la etiqueta, sobrevive a
-- duplicar la campaña, y no depende de que nadie respete una convención de
-- tipeo (el match por nombre ya es la parte más frágil de la atribución).
--
-- Granularidad: campaña. Una campaña rara vez mezcla los dos objetivos y es un
-- orden de magnitud menos de clicks que etiquetar ad sets. Si algún día hace
-- falta esa precisión, se agrega `ad_set_id` con default NULL y la fila actual
-- pasa a ser "toda la campaña".
--
-- Una campaña sin fila acá queda SIN CLASIFICAR: no se cuenta en ninguna de las
-- dos secciones. Es a propósito — sumarla en las dos duplicaría el gasto y
-- dejaría el costo por captación a la mitad del real.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_goals (
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta',
  campaign_id TEXT NOT NULL,
  goal TEXT NOT NULL CHECK (goal IN ('captacion', 'demanda')),
  -- Denormalizado sólo para poder auditar qué se etiquetó; el match nunca lo usa.
  campaign_name TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, provider, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_goals_org ON campaign_goals(org_id, provider);
