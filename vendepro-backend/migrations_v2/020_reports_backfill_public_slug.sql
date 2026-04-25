-- 020_reports_backfill_public_slug.sql
-- Backfill de public_slug para reports preexistentes (creados antes de la mig 019).
-- El slug TS-generado en create-report usa formato {address}-{period}-{uid6}.
-- Acá replicamos un slugify "best effort" en SQL puro (sin regex):
--   - LOWER y reemplazos de acentos/espacios/puntuación común
--   - address truncado a 40 chars, period_label a 20 chars
--   - uid: 6 chars hex random (RANDOMBLOB)
-- Aplica a TODOS los reports sin slug (published y draft) para uniformidad con
-- los nuevos creados después de la mig 019.

UPDATE reports
SET public_slug = (
  SELECT
    SUBSTR(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          LOWER(COALESCE(p.address, 'reporte')),
          'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'),
          'ñ', 'n'), 'ü', 'u'), 'ç', 'c'),
          ' ', '-'), '.', ''),
          ',', ''), '°', ''), '/', '-'), '''', ''), '"', ''),
          '#', ''), '(', ''), ')', ''), '&', 'y'), '--', '-'),
      1, 40
    )
    || '-' ||
    SUBSTR(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        LOWER(COALESCE(r2.period_label, 'periodo')),
        'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'),
        ' ', '-'), '.', ''), ',', ''),
      1, 20
    )
    || '-' ||
    LOWER(HEX(RANDOMBLOB(3)))
  FROM reports r2
  LEFT JOIN properties p ON r2.property_id = p.id
  WHERE r2.id = reports.id
)
WHERE public_slug IS NULL;
