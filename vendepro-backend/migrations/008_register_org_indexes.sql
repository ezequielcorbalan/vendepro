-- migrations/008_register_org_indexes.sql
-- Índice para búsquedas de usuarios por org (mejora queries de /admin/agents y /register-org)
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
