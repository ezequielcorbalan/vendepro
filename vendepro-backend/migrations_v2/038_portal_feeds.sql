-- ───────────────────────────────────────────────────────────────
-- 038_portal_feeds.sql
-- Publicación en portales inmobiliarios (ZonaProp / Argenprop / MELI)
-- vía feed XML: el portal crawlea una URL pública nuestra y sincroniza.
--
-- 1) Columnas de aviso que `properties` no tenía y los portales exigen.
-- 2) Tabla `portal_feeds`: un token público por (org, portal) + los datos
--    del anunciante que van en la cabecera del feed.
--
-- NO es idempotente: SQLite no tiene ADD COLUMN IF NOT EXISTS, así que los
-- ALTER fallan si se corre dos veces (mismo criterio que 004 y 013).
-- ───────────────────────────────────────────────────────────────

-- 1) Campos de aviso ------------------------------------------------
-- title/description son los que van al portal. Si están NULL el feed
-- cae a un texto derivado (ver zonaprop-feed-mapper.ts) para no romper.
ALTER TABLE properties ADD COLUMN title TEXT;
ALTER TABLE properties ADD COLUMN description TEXT;
ALTER TABLE properties ADD COLUMN bathrooms INTEGER;
ALTER TABLE properties ADD COLUMN covered_m2 REAL;
ALTER TABLE properties ADD COLUMN parking_spaces INTEGER;
ALTER TABLE properties ADD COLUMN antiquity_years INTEGER;
ALTER TABLE properties ADD COLUMN expenses REAL;
ALTER TABLE properties ADD COLUMN expenses_currency TEXT DEFAULT 'ARS';
ALTER TABLE properties ADD COLUMN latitude REAL;
ALTER TABLE properties ADD COLUMN longitude REAL;
ALTER TABLE properties ADD COLUMN province TEXT DEFAULT 'Buenos Aires';
ALTER TABLE properties ADD COLUMN postal_code TEXT;

-- Opt-in explícito por propiedad. Nada sale a un portal sin que alguien
-- lo marque: evita que un alta a medio cargar se publique sola.
ALTER TABLE properties ADD COLUMN publish_portals INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_properties_publish_portals
  ON properties(org_id, publish_portals);

-- 2) Feeds por org --------------------------------------------------
CREATE TABLE IF NOT EXISTS portal_feeds (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  portal TEXT NOT NULL,
  -- Parte secreta de la URL pública. El portal no autentica: la única
  -- protección del feed es que la URL no sea adivinable.
  token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  -- Datos del anunciante que van en cada <ad>. Pueden diferir del
  -- contacto interno de la org (ej: un 0800 comercial).
  advertiser_name TEXT,
  advertiser_email TEXT,
  advertiser_phone TEXT,
  -- Telemetría del crawl: si `last_fetched_at` queda viejo, ZonaProp
  -- dejó de leer el feed y las publicaciones se van a vencer.
  last_fetched_at TEXT,
  fetch_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(org_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_portal_feeds_token ON portal_feeds(token);
