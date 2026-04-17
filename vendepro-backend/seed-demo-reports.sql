-- Seed de datos de prueba para /reportes/performance en DB local.
-- Inserta 3 reportes: uno real (Bauness 2906, datos compartidos por Gastón
-- desde el reporte público del deployment previo) y 2 ficticios para poblar
-- el ranking por barrio y la timeline.
--
-- Usa subqueries para resolver org_id y admin_id en runtime, de modo que
-- funciona en cualquier DB local que tenga el seed base (seed-local.js)
-- aplicado, sin necesidad de conocer los IDs específicos.
--
-- Uso:
--   npx wrangler d1 execute DB --local \
--     --persist-to .wrangler-local \
--     --config packages/api-auth/wrangler.jsonc \
--     --file seed-demo-reports.sql

-- ── Properties ─────────────────────────────────────────────────
INSERT OR IGNORE INTO properties (
  id, org_id, address, neighborhood, city, property_type,
  rooms, size_m2, asking_price, currency,
  owner_name, public_slug, agent_id, status
) VALUES
  ('prop-bauness-2906',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Bauness 2906', 'Villa Urquiza', 'Capital Federal', 'departamento',
   2, 45, 85000, 'USD',
   'Propietario Demo', 'bauness-2906-villa-urquiza',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'active'),

  ('prop-demo-belgrano',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Cabildo 2500', 'Belgrano', 'Capital Federal', 'departamento',
   3, 72, 165000, 'USD',
   'Propietario Demo 2', 'cabildo-2500-belgrano',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'active'),

  ('prop-demo-urquiza-2',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Triunvirato 4180', 'Villa Urquiza', 'Capital Federal', 'departamento',
   2, 50, 98000, 'USD',
   'Propietario Demo 3', 'triunvirato-4180-villa-urquiza',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'active');

-- ── Reports (published) ────────────────────────────────────────
INSERT OR IGNORE INTO reports (
  id, property_id, period_label, period_start, period_end,
  status, created_by, published_at
) VALUES
  ('rep-bauness-mar', 'prop-bauness-2906',
   'Marzo 2026', '2026-03-09', '2026-04-01',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-04-01T10:00:00Z'),

  ('rep-belgrano-feb', 'prop-demo-belgrano',
   'Febrero 2026', '2026-02-01', '2026-02-28',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-03-02T09:00:00Z'),

  ('rep-urquiza2-feb', 'prop-demo-urquiza-2',
   'Febrero 2026', '2026-02-01', '2026-02-28',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-03-05T11:30:00Z');

-- ── Report metrics ─────────────────────────────────────────────
-- Bauness 2906 (datos reales del reporte público compartido)
INSERT OR IGNORE INTO report_metrics (
  id, report_id, source, impressions, portal_visits, inquiries,
  phone_calls, whatsapp, in_person_visits, offers
) VALUES
  ('rm-bauness-mar-zp', 'rep-bauness-mar', 'zonaprop',
   11012, 784, 10, 0, 0, 3, 0),
  ('rm-bauness-mar-ml', 'rep-bauness-mar', 'mercadolibre',
   0, 0, 4, 0, 0, 0, 0),

-- Belgrano Feb (ficticio pero plausible para una prop más cara)
  ('rm-belgrano-feb-zp', 'rep-belgrano-feb', 'zonaprop',
   6500, 420, 8, 1, 2, 2, 2),

-- Urquiza 2 Feb (ficticio)
  ('rm-urquiza2-feb-zp', 'rep-urquiza2-feb', 'zonaprop',
   4200, 310, 5, 0, 1, 1, 0);

-- ── Propiedad vendida (benchmark para comparativa) ─────────────
INSERT OR IGNORE INTO properties (
  id, org_id, address, neighborhood, city, property_type,
  rooms, size_m2, asking_price, currency,
  owner_name, public_slug, agent_id, status,
  sold_price, sold_date, days_on_market
) VALUES
  ('prop-demo-urquiza-sold',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Álvarez Thomas 2750', 'Villa Urquiza', 'Capital Federal', 'departamento',
   3, 65, 135000, 'USD',
   'Propietario Vendida', 'alvarez-thomas-2750-villa-urquiza',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'sold',
   130000, '2026-03-15', 90);

INSERT OR IGNORE INTO reports (
  id, property_id, period_label, period_start, period_end,
  status, created_by, published_at
) VALUES
  ('rep-urquiza-sold-ene', 'prop-demo-urquiza-sold',
   'Enero 2026', '2026-01-01', '2026-01-31',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-02-01T10:00:00Z'),
  ('rep-urquiza-sold-feb', 'prop-demo-urquiza-sold',
   'Febrero 2026', '2026-02-01', '2026-02-28',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-03-01T10:00:00Z');

-- Propiedad vendida tuvo buen desempeño: ~35 vis/día (verde)
INSERT OR IGNORE INTO report_metrics (
  id, report_id, source, impressions, portal_visits, inquiries,
  phone_calls, whatsapp, in_person_visits, offers
) VALUES
  ('rm-urquiza-sold-ene-zp', 'rep-urquiza-sold-ene', 'zonaprop',
   18000, 1085, 25, 4, 6, 8, 2),
  ('rm-urquiza-sold-feb-zp', 'rep-urquiza-sold-feb', 'zonaprop',
   16500, 980, 18, 2, 4, 6, 3);

-- ── Propiedad activa SIN reports (caso edge para mostrar "Sin reportes aún") ──
INSERT OR IGNORE INTO properties (
  id, org_id, address, neighborhood, city, property_type,
  rooms, size_m2, asking_price, currency,
  owner_name, public_slug, agent_id, status
) VALUES
  ('prop-demo-nueva',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Nazca 3500', 'Villa Urquiza', 'Capital Federal', 'departamento',
   2, 48, 95000, 'USD',
   'Propietario Recién', 'nazca-3500-villa-urquiza',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'active');

-- Done.
