-- ============================================================
-- Plan comercial y módulos activados por organización
--
-- Los módulos de Marketing (publicidad, emails, landings,
-- automatizaciones) pasan a ser parte del plan PRO, y dentro de ese
-- plan se activan de a uno, a mano. Son dos condiciones distintas a
-- propósito: `plan` dice qué contrató la inmobiliaria, `modules` dice
-- qué se le habilitó de verdad. Un módulo está prendido sólo si se
-- cumplen las dos.
--
-- La activación es manual y por plataforma: no hay UI para que el
-- cliente se prenda módulos solo. Para habilitarle uno a una org:
--
--   UPDATE organizations
--   SET plan = 'pro',
--       modules = '["publicidad","emails","landings","automatizaciones"]'
--   WHERE id = 'org_xxx';
-- ============================================================

-- 'basic' | 'pro'
ALTER TABLE organizations ADD COLUMN plan TEXT NOT NULL DEFAULT 'basic';

-- Array JSON con las claves de los módulos activados, ej: ["emails"]
ALTER TABLE organizations ADD COLUMN modules TEXT NOT NULL DEFAULT '[]';

-- Las organizaciones que ya existen venían usando Marketing sin ninguna
-- restricción. Se las deja en PRO con los cuatro módulos activados: la
-- migración no le puede sacar de un día para el otro algo que ya tenían
-- funcionando. Las que se creen de acá en adelante arrancan en 'basic'
-- con la lista vacía, por el DEFAULT de las columnas.
UPDATE organizations
SET plan = 'pro',
    modules = '["publicidad","emails","landings","automatizaciones"]';
