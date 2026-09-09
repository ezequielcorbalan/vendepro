-- ───────────────────────────────────────────────────────────────
-- 053_ad_history.sql — histórico de pauta (F2)
--
-- Hoy la tabla de campañas es un fetch en vivo a Meta con caché de 15 minutos.
-- Eso alcanza para "qué está pasando ahora" y para nada más: no hay serie
-- temporal, no se puede comparar contra el período anterior con datos propios,
-- no se ve un día que ya pasó, y cada cambio de período es otra llamada contra
-- un endpoint que ratelimitea fuerte.
--
-- ── Decisión de granularidad ────────────────────────────────────
-- `ad_daily_metrics` guarda SOLO filas a nivel anuncio. Campaña y ad set se
-- calculan sumando. Guardar los tres niveles obligaría a mantenerlos
-- consistentes entre sí y abriría la puerta al doble conteo — el bug más caro
-- posible en una tabla de gasto.
--
-- La contra: `reach` y `frequency` NO se pueden sumar (Meta los deduplica por
-- persona). Se guardan a nivel anuncio y no se agregan hacia arriba; si algún
-- día hacen falta a nivel campaña, se piden aparte.
--
-- ── Idempotencia ────────────────────────────────────────────────
-- El cron baja ayer y REESCRIBE los últimos 7 días, porque Meta reatribuye
-- hacia atrás: una conversión de hace 3 días puede aparecer hoy. Por eso la
-- unicidad es (org, entidad, día) y el sync hace upsert, no insert.
-- ───────────────────────────────────────────────────────────────

-- Cuentas publicitarias de la org. Reemplaza al `ad_account_id` suelto de
-- `meta_integration`: la inmobiliaria puede tener la suya y cada agente la
-- propia (decisión del 03-sep). `owner_user_id` NULL = de la agencia.
CREATE TABLE IF NOT EXISTS ad_accounts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta',
  external_id TEXT NOT NULL,              -- act_123456
  name TEXT,
  currency TEXT,
  owner_user_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  last_sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_unique
  ON ad_accounts(org_id, provider, external_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_org ON ad_accounts(org_id, enabled);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  objective TEXT,
  status TEXT,
  daily_budget REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_campaigns_unique ON ad_campaigns(account_id, external_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_org ON ad_campaigns(org_id);

CREATE TABLE IF NOT EXISTS ad_sets (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  campaign_external_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_sets_unique ON ad_sets(account_id, external_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign ON ad_sets(campaign_external_id);

-- El creativo se guarda con el anuncio: es lo que habilita el ranking por
-- creativo y el "modo grabar" del roadmap (qué video/copy trajo los mejores
-- leads). `thumbnail_url` y `permalink` los sirve Meta.
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  campaign_external_id TEXT NOT NULL,
  ad_set_external_id TEXT,
  external_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  creative_thumbnail_url TEXT,
  creative_title TEXT,
  creative_body TEXT,
  creative_permalink TEXT,
  -- URL de destino del anuncio: en F3 es el default automático del objetivo
  -- comercial (landing de tasación → captación; de propiedad → demanda).
  destination_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_unique ON ads(account_id, external_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign ON ads(campaign_external_id);

CREATE TABLE IF NOT EXISTS ad_daily_metrics (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  ad_external_id TEXT NOT NULL,
  campaign_external_id TEXT NOT NULL,
  ad_set_external_id TEXT,
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  -- No se agregan hacia arriba (Meta los deduplica por persona).
  reach INTEGER,
  frequency REAL,
  currency TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_daily_unique
  ON ad_daily_metrics(org_id, ad_external_id, date);
CREATE INDEX IF NOT EXISTS idx_ad_daily_range
  ON ad_daily_metrics(org_id, date);
CREATE INDEX IF NOT EXISTS idx_ad_daily_campaign
  ON ad_daily_metrics(org_id, campaign_external_id, date);

-- Semilla: las cuentas que ya están configuradas en meta_integration pasan a
-- ser cuentas de la org, atribuidas al agente que las cargó. Así el histórico
-- arranca a llenarse sin que nadie tenga que reconfigurar nada.
INSERT OR IGNORE INTO ad_accounts (id, org_id, provider, external_id, owner_user_id, enabled, created_at, updated_at)
SELECT
  'adacc_' || mi.agent_id,
  mi.org_id,
  'meta',
  mi.ad_account_id,
  mi.agent_id,
  mi.enabled,
  datetime('now'),
  datetime('now')
FROM meta_integration mi
WHERE mi.ad_account_id IS NOT NULL AND mi.ad_account_id != '';
