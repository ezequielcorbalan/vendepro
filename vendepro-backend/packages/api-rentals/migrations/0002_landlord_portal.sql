-- Add portal token to landlords
-- Nota: SQLite no permite `ADD COLUMN ... UNIQUE` en un ALTER TABLE,
-- así que agregamos la columna sin UNIQUE y forzamos unicidad vía índice.
-- Un UNIQUE INDEX en SQLite permite múltiples NULLs, que es el comportamiento
-- deseado (la mayoría de landlords no tienen token aún).
ALTER TABLE landlords ADD COLUMN portal_token TEXT;
ALTER TABLE landlords ADD COLUMN portal_active INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_landlords_portal_token
  ON landlords(portal_token)
  WHERE portal_token IS NOT NULL;
