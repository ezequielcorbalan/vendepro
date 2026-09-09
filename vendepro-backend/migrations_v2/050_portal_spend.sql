-- ───────────────────────────────────────────────────────────────
-- 050_portal_spend.sql
--
-- Gasto en portales (ZonaProp, ArgenProp, MercadoLibre, otros), cargado a
-- mano una vez por mes. Los portales no exponen API de facturación, así que
-- no hay forma de traerlo solo — pero son tres o cuatro filas por mes y
-- desbloquean la métrica que hoy no tiene nadie: cuánto cuesta un lead de
-- portal, y cómo se compara contra uno de Meta.
--
-- Es gasto de DEMANDA (compradores consultando una publicación), no de
-- captación: se cruza contra los leads del pipeline comprador. Por eso
-- `provider` guarda exactamente el mismo valor que `leads.source` — si no
-- matchea con una fuente real, el gasto queda huérfano y no se puede
-- calcular ningún costo.
--
-- Moneda: los portales facturan en pesos y los honorarios son en dólares.
-- Cada fila guarda su importe en la moneda original MÁS la cotización usada,
-- congelada al momento de la carga (`usd_rate`): un gasto de julio tiene que
-- seguir valiendo lo que valía en julio. `usd_rate` es cuántas unidades de
-- `currency` equivalen a 1 USD (1 cuando currency='USD'); null = no se pudo
-- resolver y hay que completarla a mano — nunca se inventa un número.
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS portal_spend (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,

  -- Mismo valor que leads.source, para que el cruce sea directo.
  provider TEXT NOT NULL,
  -- Nombre a mostrar cuando el portal no está en el catálogo (ej. 'Properati').
  provider_label TEXT,

  -- 'YYYY-MM' — el gasto de portales se factura por mes, no por día.
  period_month TEXT NOT NULL,

  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  usd_rate REAL,
  usd_rate_source TEXT,
  usd_rate_at TEXT,

  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un gasto por portal por mes: volver a cargar el mismo mes pisa la fila.
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_spend_unique
  ON portal_spend(org_id, provider, period_month);

CREATE INDEX IF NOT EXISTS idx_portal_spend_org_period
  ON portal_spend(org_id, period_month);
