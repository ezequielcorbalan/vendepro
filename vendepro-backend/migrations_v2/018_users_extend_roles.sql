-- 018_users_extend_roles.sql
-- Expande el CHECK constraint de users.role a ('owner', 'admin', 'supervisor', 'agent')
-- y agrega esos roles al catálogo `roles`.
--
-- ⚠️ Por qué este approach (RENAME COLUMN + ADD + UPDATE + DROP COLUMN):
--
-- El approach clásico de SQLite "12-step" — recrear users_v2 + DROP TABLE users
-- + RENAME — falla en D1 remote con `internal error [code: 7500]` o `D1_RESET_DO`
-- aun usando `PRAGMA defer_foreign_keys = ON`. La ejecución del DROP TABLE rompe
-- el Durable Object porque hay 13 tablas con FKs apuntando a `users(id)`, y D1
-- no permite `PRAGMA writable_schema = ON` (devuelve SQLITE_AUTH).
--
-- El approach de abajo NO recrea la tabla — solo modifica la columna `role`:
--   1) ALTER TABLE users RENAME COLUMN role TO role_old;
--   2) ALTER TABLE users ADD COLUMN role ... CHECK (rol nuevo);
--   3) UPDATE users SET role = role_old;
--   4) ALTER TABLE users DROP COLUMN role_old;
-- Esto deja las FKs intactas y aplica el nuevo CHECK constraint.
--
-- Esta migration ya fue aplicada manualmente en remoto el 2026-04-25 vía
-- `wrangler d1 execute --remote --command` statement por statement. Quedó
-- registrada en d1_migrations para que `wrangler d1 migrations apply` la saltee.
-- Para aplicarla local: `npx wrangler d1 migrations apply vendepro-db`.

ALTER TABLE users RENAME COLUMN role TO role_old;

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'agent'
  CHECK (role IN ('owner', 'admin', 'supervisor', 'agent'));

UPDATE users SET role = role_old;

ALTER TABLE users DROP COLUMN role_old;

INSERT OR IGNORE INTO roles (id, name, label) VALUES
  (3, 'supervisor', 'Supervisor'),
  (4, 'owner', 'Propietario de cuenta');
