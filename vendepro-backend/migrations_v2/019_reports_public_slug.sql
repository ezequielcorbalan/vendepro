-- 019_reports_public_slug.sql
-- Cada reporte tiene su propia URL pública r/{address-slug}-{period-slug}-{uid}.
-- El slug se genera al crear el reporte; el endpoint público filtra por status='published'.
-- Reports existentes quedan con NULL hasta que se republiquen.

ALTER TABLE reports ADD COLUMN public_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_public_slug ON reports(public_slug)
  WHERE public_slug IS NOT NULL;
