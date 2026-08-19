-- 041_ficha_publica.sql
-- Ficha de Tasación pública: link que completa el PROPIETARIO desde el celular,
-- sin entrar al CRM y sin cuenta. Al enviarse crea contacto + lead + ficha +
-- tasación en borrador, todo linkeado.
--
-- Distinta de la Ficha de Visita (012_): esa la llena el COMPRADOR después de
-- ver una propiedad ya captada. Esta la llena el DUEÑO antes de la captación.
--
-- Dos modos de link, misma tabla:
--   - 'single': el agente lo genera para un lead concreto ("completame esto
--     antes de que vaya el martes"). Llega pre-llenado y se consume una vez.
--   - 'open': link permanente del agente o de la inmobiliaria, para bio de
--     Instagram / firma de mail / flyer. Cada envío crea un lead nuevo.

CREATE TABLE IF NOT EXISTS ficha_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  -- Dueño del link. NULL = link institucional: el lead cae en el admin de la org.
  agent_id TEXT REFERENCES users(id),
  mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'open')),
  slug TEXT NOT NULL,
  -- Nombre interno para distinguirlos en la lista ("Bio Instagram", "Flyer Núñez").
  label TEXT,
  -- Sólo mode='single': lead del que nació el link.
  lead_id TEXT REFERENCES leads(id),
  -- Sólo mode='single': JSON con los campos que llegan pre-cargados
  -- ({ address, neighborhood, owner_name, owner_phone, owner_email }).
  prefill_json TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  submissions_count INTEGER NOT NULL DEFAULT 0,
  last_submitted_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ficha_links_slug ON ficha_links(slug);
CREATE INDEX IF NOT EXISTS idx_ficha_links_org ON ficha_links(org_id, active);
CREATE INDEX IF NOT EXISTS idx_ficha_links_agent ON ficha_links(agent_id);
CREATE INDEX IF NOT EXISTS idx_ficha_links_lead ON ficha_links(lead_id);

-- ============================================================
-- fichas_tasacion: capa pública
-- ============================================================

-- Link del que nació la ficha (NULL = cargada a mano por el agente).
ALTER TABLE fichas_tasacion ADD COLUMN ficha_link_id TEXT;
-- NULL mientras el propietario no envió. Las cargadas por el agente nacen con fecha.
ALTER TABLE fichas_tasacion ADD COLUMN submitted_at TEXT;
-- 'agente' | 'propietario' — quién la completó. Cambia cuánto confiar en los m2.
ALTER TABLE fichas_tasacion ADD COLUMN filled_by TEXT NOT NULL DEFAULT 'agente';

-- ============================================================
-- fichas_tasacion: datos del propietario
-- ============================================================
-- Se guardan en la ficha además del contacto porque el link abierto puede
-- llegar antes de que exista contacto, y porque el dato declarado por el dueño
-- es evidencia de lo que dijo, no debe pisarse al editar el contacto.

ALTER TABLE fichas_tasacion ADD COLUMN owner_name TEXT;
ALTER TABLE fichas_tasacion ADD COLUMN owner_phone TEXT;
ALTER TABLE fichas_tasacion ADD COLUMN owner_email TEXT;

-- ============================================================
-- fichas_tasacion: campos que pedía la ficha web y no existían
-- ============================================================

-- Letra o número de unidad ("B", "104"). `floor_number` ya es TEXT a propósito
-- (admite "PB", "Entrepiso"); esto lo complementa.
ALTER TABLE fichas_tasacion ADD COLUMN unit TEXT;
-- Ambientes ≠ dormitorios: `bedrooms` son dormitorios, esto es la tipología
-- que declara el propietario (monoambiente, 2, 3, 4, 5+).
ALTER TABLE fichas_tasacion ADD COLUMN rooms INTEGER;
-- 'independiente' | 'integrada'
ALTER TABLE fichas_tasacion ADD COLUMN kitchen_type TEXT;
-- 'si' | 'no' | 'parcial'
ALTER TABLE fichas_tasacion ADD COLUMN furnished TEXT;
-- 'muy_luminoso' | 'luminoso' | 'poco_luminoso'
ALTER TABLE fichas_tasacion ADD COLUMN light_level TEXT;
-- 'no_tiene' | 'fija_cubierta' | 'fija_descubierta' | 'alquila_aparte'.
-- `parking_spots` sigue siendo la cantidad; esto es la modalidad.
ALTER TABLE fichas_tasacion ADD COLUMN parking_type TEXT;
-- 'si' | 'no' | 'a_convenir'
ALTER TABLE fichas_tasacion ADD COLUMN pets_allowed TEXT;

-- No es UNIQUE: un link 'open' produce N fichas. El tope de una sola ficha por
-- link 'single' lo aplica SubmitPublicFichaUseCase.
CREATE INDEX IF NOT EXISTS idx_fichas_link ON fichas_tasacion(ficha_link_id);
