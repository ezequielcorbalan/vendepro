-- ───────────────────────────────────────────────────────────────
-- 052_property_income.sql
--
-- Cuánto plata entró a la inmobiliaria por una operación cerrada.
--
-- Hoy el CRM sabe a cuánto se vendió la propiedad (`sold_price`, `sold_date`)
-- pero no cuánto cobró la inmobiliaria. Sin ese número hay costo por lead pero
-- no hay ROI: no se puede decir si la pauta y los portales se pagan solos.
--
-- Va en `properties` y no en `reservations` a propósito: `reservations` existe
-- en el backend pero el producto no la usa — ninguna pantalla la consume, y no
-- tiene FK a propiedad, lead ni contacto. La venta real pasa por la propiedad,
-- que además ya tiene las dos puntas de la cadena de atribución:
--   • `properties.lead_id`  → el lead de captación que la originó (migración 004)
--   • `lead_properties`     → el lead comprador que la compró (migración 039)
--
-- Moneda: los honorarios normalmente son en dólares, pero se admite pesos con
-- la misma regla que el gasto de portales — importe + moneda + cotización
-- congelada al cargar. Nunca se recalcula: un cierre de julio tiene que seguir
-- valiendo lo de julio.
-- ───────────────────────────────────────────────────────────────

ALTER TABLE properties ADD COLUMN commission_amount REAL;
ALTER TABLE properties ADD COLUMN commission_currency TEXT DEFAULT 'USD';
ALTER TABLE properties ADD COLUMN commission_usd_rate REAL;
ALTER TABLE properties ADD COLUMN commission_usd_rate_source TEXT;
ALTER TABLE properties ADD COLUMN commission_usd_rate_at TEXT;

-- Fecha en que se registró el ingreso. Es la que acota los reportes: `sold_date`
-- puede ser la de la escritura y cargarse retroactiva.
ALTER TABLE properties ADD COLUMN income_at TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_income ON properties(org_id, income_at);
