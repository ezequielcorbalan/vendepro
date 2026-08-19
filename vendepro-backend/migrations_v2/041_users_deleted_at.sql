-- ───────────────────────────────────────────────────────────────
-- 041_users_deleted_at.sql
-- Papelera de agentes: el borrado de usuarios ya era soft-delete
-- (users.active = 0), pero no quedaba registro de CUÁNDO se borró.
-- Agrega deleted_at para poder mostrar "eliminado el X" en la
-- papelera de /admin/agentes y ordenar por más reciente.
--
-- El código del repo escribe deleted_at en un UPDATE aparte con
-- try/catch, así que el borrado sigue funcionando aunque esta
-- migración todavía no se haya aplicado.
-- ───────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN deleted_at TEXT;

-- Los usuarios ya desactivados antes de esta migración quedan con
-- deleted_at NULL: la UI los muestra sin fecha, no se pierde nada.
