-- 007_roles_and_notifications.sql
-- Tablas nuevas: roles (catálogo para /admin/roles) y notifications (in-app)

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL
);

INSERT INTO roles (id, name, label) VALUES
  (1, 'admin', 'Administrador'),
  (2, 'agent', 'Agente');

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('lead_assigned','task_overdue','reservation_update','system')),
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);
