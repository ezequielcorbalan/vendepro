-- 027_state_machine_unification.sql
-- Unifica state machines de lead y property con estados nuevos y sincronización cruzada.
--
-- Assumptions:
--   operation_type_id=1 → venta   (verified: migrations_v2/005_property_catalog_tables.sql line 33)
--   operation_type_id=2 → alquiler (verified: migrations_v2/005_property_catalog_tables.sql line 34)
--
-- Existing commercial_stages (from 005):
--   Venta:    captacion, publicada, con_ofertas, reservada, vendida, suspendida, perdida
--   Alquiler: captacion, publicada, con_interesados, alquilada, suspendida

-- ============================================================
-- 1. Nuevos commercial_stages para VENTA (operation_type_id=1)
--    'perdida' ya existe en venta → INSERT OR IGNORE la protege.
--    'captada' y 'invalida' son nuevos.
-- ============================================================
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (1, 'propuesta', 'Propuesta',  0,  0, 'gray'),
  (1, 'perdida',   'Perdida',    98, 1, 'red'),
  (1, 'invalida',  'Inválida',   97, 1, 'gray');

-- ============================================================
-- 2. Nuevos commercial_stages para ALQUILER (operation_type_id=2)
--    'perdida' no existe en alquiler → se inserta.
--    'propuesta' e 'invalida' también son nuevos.
-- ============================================================
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (2, 'propuesta', 'Propuesta',  0,  0, 'gray'),
  (2, 'perdida',   'Perdida',    98, 1, 'red'),
  (2, 'invalida',  'Inválida',   97, 1, 'gray');

-- ============================================================
-- 3. Unificar slugs legacy de alquiler con los de venta
--    captacion → captada   (alquiler equivale al paso de captación completada)
--    alquilada → vendida   (terminal exitoso unificado)
--    con_interesados → publicada  (ya existe en venta con ese nombre)
--
-- NOTA: la tabla commercial_stages tiene (operation_type_id, slug) como
-- clave lógica única; UPDATE solo afecta filas de alquiler (operation_type_id=2).
-- 'publicada' ya existe para alquiler → el UPDATE de con_interesados→publicada
-- dejará duplicado; por eso se elimina la fila legacy luego del UPDATE.
-- ============================================================
UPDATE commercial_stages SET slug='captada'   WHERE operation_type_id=2 AND slug='captacion';
UPDATE commercial_stages SET slug='vendida'   WHERE operation_type_id=2 AND slug='alquilada';

-- con_interesados → publicada: 'publicada' ya existe para alquiler,
-- así que borramos la fila legacy en lugar de renombrar (evita duplicado).
-- Re-point any commercial_stage_id FKs from con_interesados (alquiler) to publicada (alquiler)
-- BEFORE deleting the row to avoid orphan FK references.
UPDATE properties
SET commercial_stage_id = (
  SELECT id FROM commercial_stages WHERE operation_type_id = 2 AND slug = 'publicada'
)
WHERE commercial_stage_id IN (
  SELECT id FROM commercial_stages WHERE operation_type_id = 2 AND slug = 'con_interesados'
);
DELETE FROM commercial_stages WHERE operation_type_id=2 AND slug='con_interesados';

-- Sincronizar datos en properties
UPDATE properties SET commercial_stage='captada'   WHERE commercial_stage='captacion';
UPDATE properties SET commercial_stage='vendida'   WHERE commercial_stage='alquilada';
UPDATE properties SET commercial_stage='publicada' WHERE commercial_stage='con_interesados';

-- ============================================================
-- 4. Backfill conservador: properties asociadas a leads no-captados
--    que están en 'captada' sin ningún stage_history → mover a 'propuesta'.
--    Criterio: sin stage_history previo evita pisar progreso real.
-- ============================================================
UPDATE properties
SET commercial_stage = 'propuesta'
WHERE lead_id IS NOT NULL
  AND commercial_stage = 'captada'
  AND lead_id IN (
    SELECT id FROM leads
    WHERE stage NOT IN ('captado', 'finalizado', 'perdido', 'invalido')
  )
  AND id NOT IN (
    SELECT entity_id FROM stage_history WHERE entity_type = 'property'
  );

-- ============================================================
-- 5. Agregar columna triggered_by a stage_history
--    Permite distinguir cambios automáticos (sync-engine) de manuales (user).
--    DEFAULT 'user' para backfill de filas existentes.
-- ============================================================
ALTER TABLE stage_history ADD COLUMN triggered_by TEXT NOT NULL DEFAULT 'user';

-- ============================================================
-- 6. property_statuses: no se eliminan en esta release.
--    Se removerán en migration futura una vez validado que ningún
--    código las consume.
-- ============================================================

-- ============================================================
-- 7. Lead stages nuevos: no requieren cambio de schema
--    (stage es columna TEXT libre en leads).
--    Valores válidos post-migración:
--    nuevo, asignado, contactado, calificado, en_tasacion,
--    presentada, seguimiento, captado, invalido, finalizado, perdido
-- ============================================================
