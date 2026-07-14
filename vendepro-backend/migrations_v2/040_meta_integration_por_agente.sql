-- ───────────────────────────────────────────────────────────────
-- 040_meta_integration_por_agente.sql
-- La integración de marketing (Meta Pixel/CAPI + GA4) pasa de
-- org-level a AGENTE-level: cada usuario configura su propio pixel,
-- token, GA4, Stape, GTM y Ad Account. Sin default de org (si un
-- agente no configuró, sus eventos no disparan nada).
--
-- Preserva la config existente de cada org asignándola a su
-- owner/admin más antiguo (así no se pierde el setup actual).
-- SQLite no permite ALTER PRIMARY KEY → rebuild de tabla.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE meta_integration_new (
  agent_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  pixel_id TEXT,
  access_token_encrypted TEXT,
  stape_endpoint TEXT,
  gtm_container_id TEXT,
  test_event_code TEXT,
  ad_account_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  ga4_measurement_id TEXT,
  ga4_api_secret_encrypted TEXT,
  ga4_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- Migrar cada fila org-level al owner/admin más antiguo de esa org.
-- Si la org no tuviera admin/owner (no debería), la fila se descarta.
INSERT INTO meta_integration_new (
  agent_id, org_id, pixel_id, access_token_encrypted, stape_endpoint,
  gtm_container_id, test_event_code, ad_account_id, enabled,
  ga4_measurement_id, ga4_api_secret_encrypted, ga4_enabled, created_at, updated_at
)
SELECT
  (SELECT u.id FROM users u
     WHERE u.org_id = mi.org_id AND u.role IN ('owner', 'admin')
     ORDER BY u.created_at ASC LIMIT 1),
  mi.org_id, mi.pixel_id, mi.access_token_encrypted, mi.stape_endpoint,
  mi.gtm_container_id, mi.test_event_code, mi.ad_account_id, mi.enabled,
  mi.ga4_measurement_id, mi.ga4_api_secret_encrypted, mi.ga4_enabled,
  mi.created_at, mi.updated_at
FROM meta_integration mi
WHERE (SELECT u.id FROM users u
         WHERE u.org_id = mi.org_id AND u.role IN ('owner', 'admin')
         ORDER BY u.created_at ASC LIMIT 1) IS NOT NULL;

DROP TABLE meta_integration;
ALTER TABLE meta_integration_new RENAME TO meta_integration;
CREATE INDEX IF NOT EXISTS idx_meta_integration_org ON meta_integration(org_id);

-- El log de eventos se atribuye al agente (cada uno ve los suyos).
ALTER TABLE meta_event_log ADD COLUMN agent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_meta_event_log_agent ON meta_event_log(agent_id);
