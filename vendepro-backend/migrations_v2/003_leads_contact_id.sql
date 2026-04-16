-- vendepro-backend/migrations_v2/003_leads_contact_id.sql

-- 1. Agregar contact_id a leads (nullable — se completa con migración de datos)
ALTER TABLE leads ADD COLUMN contact_id TEXT REFERENCES contacts(id);

-- 2. Agregar api_key a organizations
ALTER TABLE organizations ADD COLUMN api_key TEXT;

-- 3. Migración de datos: crear contactos desde leads existentes
--    Solo para leads que tienen un agente válido (assigned_to o el primero del org).
--    Leads sin agente quedan con contact_id NULL — se vincularán cuando se asignen.
INSERT OR IGNORE INTO contacts (id, org_id, full_name, phone, email, contact_type, neighborhood, notes, source, agent_id, created_at)
SELECT
  'ct_' || l.id,
  l.org_id,
  l.full_name,
  l.phone,
  l.email,
  'propietario',
  l.neighborhood,
  l.notes,
  l.source,
  COALESCE(
    CASE WHEN l.assigned_to IS NOT NULL AND EXISTS(SELECT 1 FROM users WHERE id = l.assigned_to)
         THEN l.assigned_to ELSE NULL END,
    (SELECT u.id FROM users u WHERE u.org_id = l.org_id ORDER BY u.created_at LIMIT 1)
  ),
  l.created_at
FROM leads l
WHERE l.full_name IS NOT NULL
  AND trim(l.full_name) != ''
  AND l.contact_id IS NULL
  AND COALESCE(
    CASE WHEN l.assigned_to IS NOT NULL AND EXISTS(SELECT 1 FROM users WHERE id = l.assigned_to)
         THEN l.assigned_to ELSE NULL END,
    (SELECT u.id FROM users u WHERE u.org_id = l.org_id ORDER BY u.created_at LIMIT 1)
  ) IS NOT NULL;

-- 4. Vincular leads con sus contactos recién creados
UPDATE leads
SET contact_id = 'ct_' || id
WHERE contact_id IS NULL
  AND full_name IS NOT NULL
  AND trim(full_name) != ''
  AND EXISTS(SELECT 1 FROM contacts WHERE id = 'ct_' || leads.id);
