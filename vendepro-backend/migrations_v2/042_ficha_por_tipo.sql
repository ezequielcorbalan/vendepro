-- 042_ficha_por_tipo.sql
-- La Ficha de Tasación pública ahora pregunta según el tipo de propiedad:
-- a un terreno no se le pide la cocina, a una casa no se le pide la baulera
-- del edificio. Estas columnas cubren las preguntas que sólo existen para
-- algunos tipos, más las que faltaban para todos.
--
-- Reutilizan columnas ya existentes, sin duplicar:
--   - covered_area / semi_area / uncovered_area → las tres superficies
--   - property_condition → estado del lote (baldío / a demoler)
--   - balcony_type      → espacio exterior (balcón en depto, patio en casa)
--   - kitchen_type      → suma 'kitchenette' y 'no_tiene' para local/oficina

-- Qué quiere hacer el propietario: 'venta' | 'alquiler' | 'ambas'.
-- Baja al lead como `operation` y define qué tasación se prepara.
ALTER TABLE fichas_tasacion ADD COLUMN operation TEXT;

-- ── Lote (casa, PH, terreno) ─────────────────────────────────
ALTER TABLE fichas_tasacion ADD COLUMN land_area REAL;
-- Frente: del lote en un terreno, de la vidriera en un local.
ALTER TABLE fichas_tasacion ADD COLUMN frontage_m REAL;
ALTER TABLE fichas_tasacion ADD COLUMN depth_m REAL;
-- Zonificación declarada por el dueño; se verifica después.
ALTER TABLE fichas_tasacion ADD COLUMN zoning TEXT;
-- Servicios en la puerta, coma-separado ("Agua, Luz, Cloacas").
ALTER TABLE fichas_tasacion ADD COLUMN utilities TEXT;

-- ── Casa y PH ────────────────────────────────────────────────
ALTER TABLE fichas_tasacion ADD COLUMN floors_count INTEGER;

-- ── Local y oficina ──────────────────────────────────────────
-- Rubro habilitado, texto libre: el dueño rara vez sabe el código exacto.
ALTER TABLE fichas_tasacion ADD COLUMN commercial_use TEXT;
ALTER TABLE fichas_tasacion ADD COLUMN has_warehouse TEXT;

-- ── Identificación de las unidades complementarias ───────────
-- La cochera y la baulera suelen ser UF propias y eso cambia la escritura y
-- el precio. Se piden sólo si el propietario dijo que las tiene.
ALTER TABLE fichas_tasacion ADD COLUMN parking_unit TEXT;
ALTER TABLE fichas_tasacion ADD COLUMN storage_unit TEXT;
