-- ─────────────────────────────────────────────────────────────────────────────
-- VendéPro — Seed de desarrollo local
--
-- ⚠️  EXCLUSIVO PARA LOCAL. No se aplica a producción.
--     Lo ejecuta dev.sh con `wrangler d1 execute --local --file` después de
--     correr las migraciones, así no entra en la historia de migrations_v2.
--
-- Crea:
--   • usuario admin dev@dev.com / 123456 (org_mg)
--   • 4 propiedades de venta con datos plausibles
--
-- Idempotente: usa INSERT OR IGNORE contra claves únicas (email, public_slug).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Usuario dev (admin) ──────────────────────────────────────────────────────
-- password_hash = SHA-256("123456" + "reportes-mg-salt-2026")
INSERT OR IGNORE INTO users (
  id, org_id, email, password_hash, full_name, phone, role, active
) VALUES (
  'usr_dev_local',
  'org_mg',
  'dev@dev.com',
  '5aa1d711f5e9961561dad3d85edeb858ba9417c8889b637d6c0e9f65aa7d2148',
  'Dev Local',
  '+54 11 5555 0000',
  'admin',
  1
);

-- ── 4 Propiedades de venta ───────────────────────────────────────────────────
-- Todas con agent_id = usr_dev_local, status='active', operation_type='venta'.
-- public_slug es UNIQUE, así que sirve para idempotencia.

INSERT OR IGNORE INTO properties (
  id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
  asking_price, currency, owner_name, owner_phone, owner_email,
  public_slug, agent_id, status, operation_type, operation_type_id,
  commercial_stage, commercial_stage_id
) VALUES
  (
    'prop_dev_01',
    'org_mg',
    'Av. Santa Fe 2345, Piso 8 "A"',
    'Recoleta',
    'Buenos Aires',
    'departamento',
    3,
    85.5,
    285000,
    'USD',
    'María González',
    '+54 11 5123 4567',
    'maria.gonzalez@example.com',
    'recoleta-santa-fe-2345-8a',
    'usr_dev_local',
    'active',
    'venta',
    1,
    'publicada',
    (SELECT id FROM commercial_stages WHERE slug = 'publicada' AND operation_type_id = 1)
  ),
  (
    'prop_dev_02',
    'org_mg',
    'Av. Cabildo 4120, Piso 15',
    'Belgrano',
    'Buenos Aires',
    'departamento',
    2,
    62.0,
    195000,
    'USD',
    'Jorge Pérez',
    '+54 11 5234 5678',
    'jorge.perez@example.com',
    'belgrano-cabildo-4120-15',
    'usr_dev_local',
    'active',
    'venta',
    1,
    'captacion',
    (SELECT id FROM commercial_stages WHERE slug = 'captacion' AND operation_type_id = 1)
  ),
  (
    'prop_dev_03',
    'org_mg',
    'Charcas 4567',
    'Palermo',
    'Buenos Aires',
    'casa',
    4,
    180.0,
    520000,
    'USD',
    'Lucía Fernández',
    '+54 11 5345 6789',
    'lucia.fernandez@example.com',
    'palermo-charcas-4567',
    'usr_dev_local',
    'active',
    'venta',
    1,
    'con_ofertas',
    (SELECT id FROM commercial_stages WHERE slug = 'con_ofertas' AND operation_type_id = 1)
  ),
  (
    'prop_dev_04',
    'org_mg',
    'Av. Rivadavia 5890, PB',
    'Caballito',
    'Buenos Aires',
    'ph',
    3,
    95.0,
    175000,
    'USD',
    'Roberto Sánchez',
    '+54 11 5456 7890',
    'roberto.sanchez@example.com',
    'caballito-rivadavia-5890-pb',
    'usr_dev_local',
    'active',
    'venta',
    1,
    'reservada',
    (SELECT id FROM commercial_stages WHERE slug = 'reservada' AND operation_type_id = 1)
  );

-- ── Backfill status_id para los seeds ────────────────────────────────────────
-- (compatibilidad con código que consulta por status_id en vez del string)
UPDATE properties
SET status_id = (
  SELECT id FROM property_statuses
  WHERE slug = properties.status AND operation_type_id = properties.operation_type_id
)
WHERE id IN ('prop_dev_01','prop_dev_02','prop_dev_03','prop_dev_04')
  AND status_id IS NULL;
