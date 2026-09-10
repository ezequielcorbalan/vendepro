-- ═══════════════════════════════════════════════════════════════════════════
-- Limpieza de datos — propiedades duplicadas, barrios con typo y datos de prueba
-- (10-sep-2026 · acompaña al fix de status↔etapa y benchmark por barrio)
--
-- ⚠️ NO es una migración. NO correr el archivo entero de un tirón.
--    Es un guion en 4 pasos para ejecutar A MANO contra la D1 de producción
--    (Cloudflare Dashboard → D1 → Console, o `wrangler d1 execute --remote
--    --command "..."` paso a paso).
--
--    Antes de empezar: hacer un export de la base (Dashboard → D1 → Export)
--    o anotar el timestamp para Time Travel.
--
--    Flujo: PASO 0 (solo SELECT, mirar) → PASO 1 (armar el mapa y REVISARLO)
--           → PASO 2 (merge) → PASO 3 (barrios) → PASO 4 (datos de prueba).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 0 · DIAGNÓSTICO (solo SELECT — no cambia nada)
-- ───────────────────────────────────────────────────────────────────────────

-- 0a. Direcciones duplicadas dentro de la misma org, con el detalle necesario
--     para decidir cuál copia queda. Esperados: Bauness 2906, Gurruchaga 1451,
--     Estomba 2373, Bucarest 1361, Carlos Antonio López 3169, asdfasdf.
--     Ojo: "Bauness 2906" y "Bauness 2906 PB" son unidades DISTINTAS y acá
--     no se agrupan (el texto difiere) — eso está bien.
SELECT
  p.id,
  p.org_id,
  p.address,
  p.neighborhood,
  p.commercial_stage,
  p.status,
  p.agent_id,
  p.created_at,
  (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'published') AS reportes_publicados,
  (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) AS reportes_totales,
  (SELECT COUNT(*) FROM property_photos ph WHERE ph.property_id = p.id) AS fotos,
  (SELECT COUNT(*) FROM property_links pl WHERE pl.property_id = p.id) AS links_kiteprop,
  (SELECT COUNT(*) FROM lead_properties lp WHERE lp.property_id = p.id) AS leads_compradores
FROM properties p
WHERE (p.org_id, lower(trim(p.address))) IN (
  SELECT org_id, lower(trim(address))
  FROM properties
  GROUP BY org_id, lower(trim(address))
  HAVING COUNT(*) > 1
)
ORDER BY p.org_id, lower(trim(p.address)), reportes_publicados DESC, p.created_at;

-- 0b. Reportes con métricas absurdas (candidatos a borrar; esperado: el de
--     "Sanchez de Bustamante 1996" con ~17.589 vis/día por un período de 1 día).
SELECT
  r.id AS report_id,
  p.address,
  r.period_label,
  r.period_start,
  r.period_end,
  ROUND(julianday(r.period_end) - julianday(r.period_start), 1) AS dias,
  SUM(rm.portal_visits) AS visitas_portal,
  ROUND(SUM(rm.portal_visits) / MAX(1.0, julianday(r.period_end) - julianday(r.period_start)), 1) AS vis_por_dia
FROM reports r
JOIN properties p ON p.id = r.property_id
LEFT JOIN report_metrics rm ON rm.report_id = r.id
GROUP BY r.id
HAVING vis_por_dia > 200 OR dias < 2
ORDER BY vis_por_dia DESC;

-- 0c. Datos de prueba evidentes.
SELECT id, org_id, address, neighborhood, created_at
FROM properties
WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba');

-- 0d. Variantes de barrio (el código ya normaliza mayúsculas/tildes/espacios;
--     lo único que hay que corregir a mano son los TYPOS, ej. "pueyrreedon").
SELECT lower(trim(neighborhood)) AS clave, COUNT(*) AS propiedades,
       GROUP_CONCAT(DISTINCT neighborhood) AS variantes
FROM properties
WHERE neighborhood IS NOT NULL AND trim(neighborhood) <> ''
GROUP BY clave
ORDER BY clave;


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 1 · MAPA DE MERGE (crea una tabla auxiliar; REVISAR antes del PASO 2)
--
-- Heurística para elegir la copia que QUEDA por cada dirección duplicada:
--   más reportes publicados > más fotos > la más vieja. Las demás se fusionan.
-- ───────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS _cleanup_dupe_map;

CREATE TABLE _cleanup_dupe_map AS
WITH dups AS (
  SELECT
    p.id,
    p.org_id,
    lower(trim(p.address)) AS addr_key,
    (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'published') AS pub,
    (SELECT COUNT(*) FROM property_photos ph WHERE ph.property_id = p.id) AS fotos,
    p.created_at
  FROM properties p
  WHERE (p.org_id, lower(trim(p.address))) IN (
    SELECT org_id, lower(trim(address))
    FROM properties
    GROUP BY org_id, lower(trim(address))
    HAVING COUNT(*) > 1
  )
  -- los datos de prueba no se fusionan: se borran en el PASO 4
  AND lower(trim(p.address)) NOT IN ('asdfasdf', 'test', 'prueba')
),
ranked AS (
  SELECT id, org_id, addr_key,
    FIRST_VALUE(id) OVER (
      PARTITION BY org_id, addr_key
      ORDER BY pub DESC, fotos DESC, created_at ASC, id ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY org_id, addr_key
      ORDER BY pub DESC, fotos DESC, created_at ASC, id ASC
    ) AS rn
  FROM dups
)
SELECT id AS dupe_id, keep_id
FROM ranked
WHERE rn > 1;

-- REVISAR el mapa antes de seguir. Cada fila = "esta copia se fusiona en aquella".
-- Si alguna elección está mal, corregirla a mano:
--   UPDATE _cleanup_dupe_map SET keep_id='<id-bueno>' WHERE dupe_id='<id>';
-- o sacar el par: DELETE FROM _cleanup_dupe_map WHERE dupe_id='<id>';
SELECT
  m.dupe_id, pd.address AS dupe_address, pd.created_at AS dupe_created,
  m.keep_id, pk.address AS keep_address, pk.created_at AS keep_created,
  (SELECT COUNT(*) FROM reports r WHERE r.property_id = m.dupe_id) AS reportes_a_mover
FROM _cleanup_dupe_map m
JOIN properties pd ON pd.id = m.dupe_id
JOIN properties pk ON pk.id = m.keep_id;


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 2 · MERGE — mueve TODO lo que cuelga de cada duplicada a la que queda
--          y recién después borra la duplicada.
--
-- Correr este bloque entero de una vez (idealmente como un solo batch).
-- No toca meta_event_log / automation_runs / automation_jobs: son log histórico
-- y sus dedupe keys referencian el id viejo — reescribirlos puede colisionar.
-- ───────────────────────────────────────────────────────────────────────────

-- Reportes (arrastran report_metrics / report_content / report_photos por FK al report)
UPDATE reports
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = reports.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Fotos de la propiedad
UPDATE property_photos
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = property_photos.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Historiales de precio (hay dos tablas: la legacy y la actual)
UPDATE price_history
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = price_history.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

UPDATE property_price_history
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = property_price_history.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Competidores
UPDATE competitor_links
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = competitor_links.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Fichas de visita (las dos generaciones)
UPDATE visit_forms
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = visit_forms.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

UPDATE property_visit_forms
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = property_visit_forms.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Actividades y eventos de calendario que apuntaban a la duplicada
UPDATE activities
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = activities.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

UPDATE calendar_events
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = calendar_events.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Link con KiteProp (PK por external_id: repuntar no colisiona)
UPDATE property_links
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = property_links.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Leads compradores: si el lead ya está vinculado a la copia que queda,
-- el vínculo duplicado se borra (UNIQUE lead_id+property_id); si no, se mueve.
DELETE FROM lead_properties
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map)
  AND EXISTS (
    SELECT 1 FROM lead_properties lp2
    JOIN _cleanup_dupe_map m ON m.dupe_id = lead_properties.property_id
    WHERE lp2.lead_id = lead_properties.lead_id
      AND lp2.property_id = m.keep_id
  );

UPDATE lead_properties
SET property_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = lead_properties.property_id)
WHERE property_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Historial de etapas de la duplicada pasa a la que queda
UPDATE stage_history
SET entity_id = (SELECT keep_id FROM _cleanup_dupe_map WHERE dupe_id = stage_history.entity_id)
WHERE entity_type = 'property'
  AND entity_id IN (SELECT dupe_id FROM _cleanup_dupe_map);

-- Chequeo antes de borrar: las duplicadas tienen que quedar sin reportes ni fotos.
SELECT m.dupe_id,
  (SELECT COUNT(*) FROM reports r WHERE r.property_id = m.dupe_id) AS reportes_restantes,
  (SELECT COUNT(*) FROM property_photos ph WHERE ph.property_id = m.dupe_id) AS fotos_restantes
FROM _cleanup_dupe_map m;

-- Si todo dio 0 → borrar las duplicadas y tirar el mapa.
DELETE FROM properties WHERE id IN (SELECT dupe_id FROM _cleanup_dupe_map);
DROP TABLE _cleanup_dupe_map;


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 3 · BARRIOS — solo los typos; mayúsculas/tildes/espacios ya los
--          resuelve el código (neighborhoodKey).
-- ───────────────────────────────────────────────────────────────────────────

-- Higiene general: espacios sobrantes.
UPDATE properties SET neighborhood = trim(neighborhood)
WHERE neighborhood IS NOT NULL AND neighborhood <> trim(neighborhood);

-- Typo confirmado en producción (doble e).
UPDATE properties SET neighborhood = 'Villa Pueyrredón'
WHERE lower(trim(neighborhood)) = 'villa pueyrreedon';

-- Si el 0d mostró más typos, agregarlos acá con el mismo patrón.


-- ───────────────────────────────────────────────────────────────────────────
-- PASO 4 · DATOS DE PRUEBA
-- ───────────────────────────────────────────────────────────────────────────

-- 4a. Reporte con métricas absurdas: completar el id que salió en el 0b.
--     (borra en cascada sus metrics/content/photos; las fotos en R2 quedan
--     huérfanas — se limpian solas al vencer el TTL o se ignoran).
-- DELETE FROM reports WHERE id = '<report_id_del_0b>';

-- 4b. Propiedades de prueba ("asdfasdf"): primero soltar lo que no tiene
--     ON DELETE CASCADE, después borrar (reports/fotos/fichas caen en cascada).
UPDATE activities SET property_id = NULL
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

UPDATE calendar_events SET property_id = NULL
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM property_visit_forms
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM property_price_history
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM lead_properties
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM property_links
WHERE property_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM stage_history
WHERE entity_type = 'property'
  AND entity_id IN (SELECT id FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba'));

DELETE FROM properties WHERE lower(trim(address)) IN ('asdfasdf', 'test', 'prueba');


-- ───────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL — repetir 0a (debe devolver 0 filas de duplicados reales)
-- y entrar a /reportes/performance: los barrios unificados y sin filas basura.
-- ───────────────────────────────────────────────────────────────────────────
