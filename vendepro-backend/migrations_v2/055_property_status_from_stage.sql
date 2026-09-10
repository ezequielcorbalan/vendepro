-- ───────────────────────────────────────────────────────────────
-- 055_property_status_from_stage.sql
--
-- Backfill: sincroniza properties.status y properties.status_id con la etapa
-- comercial. Hasta ahora cambiar la etapa (dropdown de la card, kanban, sync
-- desde lead) solo escribía commercial_stage: una propiedad pasada a "vencida"
-- o "vendida" por esa vía quedaba con status='active' — pill "Activa" en la
-- card y contando como aviso activo en el performance de reportes.
--
-- El código ya deriva el status en cada cambio de etapa (D1PropertyRepository
-- .updateStage); esto corrige las filas que quedaron desincronizadas.
--
-- Nota: si alguien había seteado un status a mano distinto del que sugiere la
-- etapa, acá gana la etapa — es la fuente operativa de verdad de acá en más.
-- ───────────────────────────────────────────────────────────────

-- 1. Columna TEXT en inglés (analytics filtra por 'active'/'sold').
UPDATE properties
SET status = CASE commercial_stage
  WHEN 'vendida'    THEN 'sold'
  WHEN 'alquilada'  THEN 'sold'
  WHEN 'suspendida' THEN 'suspended'
  WHEN 'vencida'    THEN 'inactive'
  WHEN 'perdida'    THEN 'archived'
  WHEN 'invalida'   THEN 'archived'
  WHEN 'archivada'  THEN 'archived'
  ELSE 'active'
END
WHERE commercial_stage IS NOT NULL
  AND status <> CASE commercial_stage
    WHEN 'vendida'    THEN 'sold'
    WHEN 'alquilada'  THEN 'sold'
    WHEN 'suspendida' THEN 'suspended'
    WHEN 'vencida'    THEN 'inactive'
    WHEN 'perdida'    THEN 'archived'
    WHEN 'invalida'   THEN 'archived'
    WHEN 'archivada'  THEN 'archived'
    ELSE 'active'
  END;

-- 2. status_id del catálogo property_statuses (el pill de la card lee este id).
--    En alquiler el catálogo no tiene 'vendida': la cerrada es 'alquilada'.
UPDATE properties
SET status_id = (
  SELECT ps.id FROM property_statuses ps
  WHERE ps.operation_type_id = COALESCE(properties.operation_type_id, 1)
    AND ps.slug = CASE
      WHEN properties.commercial_stage IN ('vendida', 'alquilada')
        THEN CASE WHEN COALESCE(properties.operation_type_id, 1) = 2 THEN 'alquilada' ELSE 'vendida' END
      WHEN properties.commercial_stage = 'suspendida' THEN 'suspendida'
      WHEN properties.commercial_stage = 'vencida'    THEN 'inactiva'
      WHEN properties.commercial_stage IN ('perdida', 'invalida', 'archivada') THEN 'archivada'
      ELSE 'activa'
    END
)
WHERE commercial_stage IS NOT NULL
  AND (
    SELECT ps.id FROM property_statuses ps
    WHERE ps.operation_type_id = COALESCE(properties.operation_type_id, 1)
      AND ps.slug = CASE
        WHEN properties.commercial_stage IN ('vendida', 'alquilada')
          THEN CASE WHEN COALESCE(properties.operation_type_id, 1) = 2 THEN 'alquilada' ELSE 'vendida' END
        WHEN properties.commercial_stage = 'suspendida' THEN 'suspendida'
        WHEN properties.commercial_stage = 'vencida'    THEN 'inactiva'
        WHEN properties.commercial_stage IN ('perdida', 'invalida', 'archivada') THEN 'archivada'
        ELSE 'activa'
      END
  ) IS NOT NULL;
