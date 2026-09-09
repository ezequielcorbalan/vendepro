-- 051_report_photos_r2_key.sql
-- report_photos no guardaba la key de R2: al borrar un reporte, el cleanup del
-- bucket dependía de reconstruir la key desde photo_url con un replace frágil.
-- Con la columna, la baja de fotos (individual o en cascada) borra el objeto
-- exacto. Nullable: las filas viejas no la tienen y el código lo tolera.
ALTER TABLE report_photos ADD COLUMN r2_key TEXT;
