-- 052_fix_undefined_photo_urls.sql
-- R2_PUBLIC_URL nunca estuvo seteada en api-properties: R2StorageService
-- fabricaba URLs "undefined/<key>" y así se guardaban. Las fotos de reporte
-- salían rotas en /r/ (visto en producción el 2026-09-10); las de propiedades
-- tenían el mismo dato roto aunque el frontend lo esquivara armando la URL
-- contra el proxy /photo/<key>. Se reconstruyen desde r2_key, que siempre
-- estuvo bien.
UPDATE report_photos
SET photo_url = 'https://properties.api.vendepro.com.ar/photo/' || r2_key
WHERE photo_url LIKE 'undefined/%' AND r2_key IS NOT NULL;

UPDATE property_photos
SET url = 'https://properties.api.vendepro.com.ar/photo/' || r2_key
WHERE url LIKE 'undefined/%' AND r2_key IS NOT NULL;
