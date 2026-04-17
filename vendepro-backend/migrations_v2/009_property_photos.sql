-- 009_property_photos.sql
-- Formaliza la tabla property_photos que ya existe en prod pero no estaba
-- declarada en las migraciones v2. IF NOT EXISTS para que sea idempotente
-- contra la DB actual.

CREATE TABLE IF NOT EXISTS property_photos (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);
