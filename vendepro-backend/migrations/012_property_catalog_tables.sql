-- ============================================================
-- Tablas catálogo: tipos de operación, etapas y estados
-- Properties pasa a referenciar por ID entero
-- ============================================================

CREATE TABLE IF NOT EXISTS operation_types (
  id    INTEGER PRIMARY KEY,
  slug  TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

INSERT OR IGNORE INTO operation_types (id, slug, label) VALUES
  (1, 'venta',    'Venta'),
  (2, 'alquiler', 'Alquiler');

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commercial_stages (
  id                INTEGER PRIMARY KEY,
  operation_type_id INTEGER NOT NULL REFERENCES operation_types(id),
  slug              TEXT NOT NULL,
  label             TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_terminal       INTEGER NOT NULL DEFAULT 0,  -- 1 = estado final
  color             TEXT NOT NULL DEFAULT 'gray',
  UNIQUE(operation_type_id, slug)
);

INSERT OR IGNORE INTO commercial_stages
  (id, operation_type_id, slug,           label,              sort_order, is_terminal, color) VALUES
  -- Venta
  (1,  1, 'captada',       'Captada',            1, 0, 'green'),
  (2,  1, 'documentacion', 'En documentación',   2, 0, 'amber'),
  (3,  1, 'publicada',     'Publicada',          3, 0, 'blue'),
  (4,  1, 'reservada',     'Reservada',          4, 0, 'purple'),
  (5,  1, 'vendida',       'Vendida',            5, 1, 'emerald'),
  (6,  1, 'suspendida',    'Suspendida',         6, 0, 'orange'),
  (7,  1, 'vencida',       'Vencida',            7, 0, 'red'),
  (8,  1, 'archivada',     'Archivada',          8, 1, 'gray'),
  -- Alquiler
  (9,  2, 'captada',       'Captada',            1, 0, 'green'),
  (10, 2, 'documentacion', 'En documentación',   2, 0, 'amber'),
  (11, 2, 'publicada',     'Publicada',          3, 0, 'blue'),
  (12, 2, 'reservada',     'Reservada',          4, 0, 'purple'),
  (13, 2, 'alquilada',     'Alquilada',          5, 1, 'cyan'),
  (14, 2, 'suspendida',    'Suspendida',         6, 0, 'orange'),
  (15, 2, 'vencida',       'Vencida',            7, 0, 'red'),
  (16, 2, 'archivada',     'Archivada',          8, 1, 'gray');

-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_statuses (
  id                INTEGER PRIMARY KEY,
  operation_type_id INTEGER REFERENCES operation_types(id),  -- NULL = aplica a ambos tipos
  slug              TEXT NOT NULL,
  label             TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT 'gray'
);

INSERT OR IGNORE INTO property_statuses (id, operation_type_id, slug, label, color) VALUES
  (1, NULL, 'active',    'Activa',     'green'),
  (2, NULL, 'suspended', 'Suspendida', 'yellow'),
  (3, NULL, 'archived',  'Archivada',  'gray'),
  (4, NULL, 'inactive',  'Inactiva',   'red'),
  (5, 1,    'sold',      'Vendida',    'pink'),
  (6, 2,    'rented',    'Alquilada',  'cyan');

-- ─────────────────────────────────────────────────────────────
-- Columnas ID en properties
ALTER TABLE properties ADD COLUMN operation_type_id  INTEGER REFERENCES operation_types(id);
ALTER TABLE properties ADD COLUMN commercial_stage_id INTEGER REFERENCES commercial_stages(id);
ALTER TABLE properties ADD COLUMN status_id           INTEGER REFERENCES property_statuses(id);

-- Migrar operation_type_id desde texto (col anterior: operation_type)
UPDATE properties SET operation_type_id = CASE
  WHEN LOWER(COALESCE(operation_type, 'venta')) = 'alquiler' THEN 2
  ELSE 1
END;

-- Migrar commercial_stage_id desde texto (col anterior: commercial_stage)
UPDATE properties SET commercial_stage_id = (
  SELECT cs.id FROM commercial_stages cs
  WHERE cs.slug = properties.commercial_stage
    AND cs.operation_type_id = properties.operation_type_id
  LIMIT 1
);
-- Fallback: 'captada' según tipo si no mapeó
UPDATE properties SET commercial_stage_id = (
  SELECT cs.id FROM commercial_stages cs
  WHERE cs.slug = 'captada' AND cs.operation_type_id = properties.operation_type_id
  LIMIT 1
) WHERE commercial_stage_id IS NULL;

-- Migrar status_id desde texto (col anterior: status)
UPDATE properties SET status_id = CASE
  WHEN status = 'active'                               THEN 1
  WHEN status = 'suspended'                            THEN 2
  WHEN status = 'archived'                             THEN 3
  WHEN status = 'inactive'                             THEN 4
  WHEN status = 'sold' AND operation_type_id = 1       THEN 5
  WHEN status = 'sold' AND operation_type_id = 2       THEN 6
  ELSE 1
END;

CREATE INDEX IF NOT EXISTS idx_properties_operation_type_id  ON properties(operation_type_id);
CREATE INDEX IF NOT EXISTS idx_properties_commercial_stage_id ON properties(commercial_stage_id);
CREATE INDEX IF NOT EXISTS idx_properties_status_id           ON properties(status_id);
