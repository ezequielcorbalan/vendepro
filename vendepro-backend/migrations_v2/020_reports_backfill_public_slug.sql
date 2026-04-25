-- 020_reports_backfill_public_slug.sql
-- Backfill de public_slug para reports preexistentes (creados antes de la mig 019).
-- Genera slug minimalista: address + period_label normalizados + uid hex.

UPDATE reports
SET public_slug = LOWER(
  SUBSTR(
    REPLACE(REPLACE(COALESCE(
      (SELECT p.address FROM properties p WHERE p.id = reports.property_id),
      'reporte'
    ), ' ', '-'), '.', ''),
    1, 40
  )
  || '-' ||
  SUBSTR(
    REPLACE(COALESCE(period_label, 'periodo'), ' ', '-'),
    1, 20
  )
  || '-' ||
  HEX(RANDOMBLOB(3))
)
WHERE public_slug IS NULL;
