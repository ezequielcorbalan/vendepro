-- 005_property_catalog_tables.sql
-- Catálogos normalizados de propiedades (reemplazan los strings hardcoded).
-- Los workers consultan estos en /property-config.

CREATE TABLE IF NOT EXISTS operation_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type_id INTEGER NOT NULL REFERENCES operation_types(id),
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_terminal INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  UNIQUE (operation_type_id, slug)
);

CREATE TABLE IF NOT EXISTS property_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_type_id INTEGER NOT NULL REFERENCES operation_types(id),
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  UNIQUE (operation_type_id, slug)
);

-- Seed: tipos de operación
INSERT INTO operation_types (id, slug, label) VALUES
  (1, 'venta', 'Venta'),
  (2, 'alquiler', 'Alquiler');

-- Seed: etapas comerciales para Venta
INSERT INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (1, 'captacion',    'Captación',       1, 0, '#f59e0b'),
  (1, 'publicada',    'Publicada',       2, 0, '#3b82f6'),
  (1, 'con_ofertas',  'Con ofertas',     3, 0, '#8b5cf6'),
  (1, 'reservada',    'Reservada',       4, 0, '#ec4899'),
  (1, 'vendida',      'Vendida',         5, 1, '#22c55e'),
  (1, 'suspendida',   'Suspendida',      6, 1, '#6b7280'),
  (1, 'perdida',      'Perdida',         7, 1, '#ef4444');

-- Seed: etapas comerciales para Alquiler
INSERT INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (2, 'captacion',    'Captación',       1, 0, '#f59e0b'),
  (2, 'publicada',    'Publicada',       2, 0, '#3b82f6'),
  (2, 'con_interesados','Con interesados',3, 0, '#8b5cf6'),
  (2, 'alquilada',    'Alquilada',       4, 1, '#22c55e'),
  (2, 'suspendida',   'Suspendida',      5, 1, '#6b7280');

-- Seed: estados para Venta
INSERT INTO property_statuses (operation_type_id, slug, label, color) VALUES
  (1, 'activa',     'Activa',     '#22c55e'),
  (1, 'vendida',    'Vendida',    '#3b82f6'),
  (1, 'reservada',  'Reservada',  '#ec4899'),
  (1, 'suspendida', 'Suspendida', '#6b7280'),
  (1, 'archivada',  'Archivada',  '#94a3b8'),
  (1, 'inactiva',   'Inactiva',   '#475569');

-- Seed: estados para Alquiler
INSERT INTO property_statuses (operation_type_id, slug, label, color) VALUES
  (2, 'activa',    'Activa',    '#22c55e'),
  (2, 'alquilada', 'Alquilada', '#3b82f6'),
  (2, 'suspendida','Suspendida','#6b7280'),
  (2, 'archivada', 'Archivada', '#94a3b8'),
  (2, 'inactiva',  'Inactiva',  '#475569');

-- Backfill properties existentes: operation_type_id desde operation_type (string)
UPDATE properties
SET operation_type_id = (SELECT id FROM operation_types WHERE slug = properties.operation_type)
WHERE operation_type_id IS NULL AND operation_type IS NOT NULL;

-- Backfill status_id desde properties.status + operation_type_id
UPDATE properties
SET status_id = (
  SELECT ps.id FROM property_statuses ps
  WHERE ps.slug = properties.status AND ps.operation_type_id = properties.operation_type_id
)
WHERE status_id IS NULL AND status IS NOT NULL AND operation_type_id IS NOT NULL;

-- Backfill commercial_stage_id desde properties.commercial_stage + operation_type_id
UPDATE properties
SET commercial_stage_id = (
  SELECT cs.id FROM commercial_stages cs
  WHERE cs.slug = properties.commercial_stage AND cs.operation_type_id = properties.operation_type_id
)
WHERE commercial_stage_id IS NULL AND commercial_stage IS NOT NULL AND operation_type_id IS NOT NULL;
