-- 018_users_extend_roles.sql
-- Expande el CHECK constraint de users.role a ('owner', 'admin', 'supervisor', 'agent')
-- y agrega esos roles al catálogo `roles`.
--
-- D1 corre cada migration dentro de una transacción implícita, por lo que
-- `PRAGMA foreign_keys = OFF` (que solo opera fuera de transacciones) falla.
-- Usamos `PRAGMA defer_foreign_keys = ON`, que pospone la validación de FKs
-- hasta el COMMIT — momento en el que la tabla `users` ya fue recreada con
-- todos los IDs originales y las FKs vuelven a resolverse correctamente.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE users_v2 (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL DEFAULT 'org_mg',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'supervisor', 'agent')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO users_v2 SELECT id, org_id, email, password_hash, full_name, phone, photo_url, role, active, created_at FROM users;

DROP TABLE users;
ALTER TABLE users_v2 RENAME TO users;

INSERT OR IGNORE INTO roles (id, name, label) VALUES
  (3, 'supervisor', 'Supervisor'),
  (4, 'owner', 'Propietario de cuenta');
