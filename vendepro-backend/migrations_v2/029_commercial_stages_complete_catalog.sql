-- 029_commercial_stages_complete_catalog.sql
-- Completa el catálogo `commercial_stages` con TODOS los slugs del dominio
-- (PropertyStage en packages/core), para ambos tipos de operación.
--
-- Bug que arregla: faltaban `documentacion`, `vencida`, `archivada` (y `captada`
-- en venta). D1PropertyRepository.updateStage() exige que el slug exista en este
-- catálogo para setear commercial_stage_id; si no, tira "invalid stage: <slug>".
-- Por eso mover una propiedad a "Documentación" en el pipeline tiraba error 400.
--
-- INSERT OR IGNORE respeta las filas existentes (UNIQUE operation_type_id, slug).
-- Los slugs legacy que ya estaban (captacion, con_ofertas) se dejan intactos;
-- el frontend los normaliza vía SLUG_ALIASES.

-- Venta (operation_type_id = 1)
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (1, 'propuesta',     'Propuesta',     0,  0, '#9ca3af'),
  (1, 'captada',       'Captada',       1,  0, '#22c55e'),
  (1, 'documentacion', 'Documentación', 2,  0, '#f59e0b'),
  (1, 'publicada',     'Publicada',     3,  0, '#3b82f6'),
  (1, 'reservada',     'Reservada',     4,  0, '#a855f7'),
  (1, 'vendida',       'Vendida',       5,  1, '#16a34a'),
  (1, 'suspendida',    'Suspendida',    6,  0, '#f97316'),
  (1, 'vencida',       'Vencida',       7,  0, '#ef4444'),
  (1, 'perdida',       'Perdida',       8,  1, '#dc2626'),
  (1, 'invalida',      'Inválida',      9,  1, '#6b7280'),
  (1, 'archivada',     'Archivada',     10, 1, '#9ca3af');

-- Alquiler (operation_type_id = 2)
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (2, 'propuesta',     'Propuesta',     0,  0, '#9ca3af'),
  (2, 'captada',       'Captada',       1,  0, '#22c55e'),
  (2, 'documentacion', 'Documentación', 2,  0, '#f59e0b'),
  (2, 'publicada',     'Publicada',     3,  0, '#3b82f6'),
  (2, 'reservada',     'Reservada',     4,  0, '#a855f7'),
  (2, 'vendida',       'Vendida',       5,  1, '#16a34a'),
  (2, 'suspendida',    'Suspendida',    6,  0, '#f97316'),
  (2, 'vencida',       'Vencida',       7,  0, '#ef4444'),
  (2, 'perdida',       'Perdida',       8,  1, '#dc2626'),
  (2, 'invalida',      'Inválida',      9,  1, '#6b7280'),
  (2, 'archivada',     'Archivada',     10, 1, '#9ca3af');
