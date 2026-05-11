-- ============================================================
-- Migración 026 — Comparables con dos tipos: publicación y venta
-- ============================================================
-- Los comparables de tasaciones ahora distinguen entre:
--   • 'publicacion' (default, datos actuales: precio listado, zonaprop, etc.)
--   • 'venta'       (cierre real: closing_price_usd, closed_at)
--
-- Se agrega además `source_sold_property_id` para trackear qué cierre real
-- (de la tabla sold_properties) se usó como fuente al autorrellenar.
-- ============================================================

ALTER TABLE appraisal_comparables
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'publicacion'
    CHECK (kind IN ('publicacion', 'venta'));

ALTER TABLE appraisal_comparables
  ADD COLUMN closing_price_usd REAL;

ALTER TABLE appraisal_comparables
  ADD COLUMN closed_at TEXT;

ALTER TABLE appraisal_comparables
  ADD COLUMN source_sold_property_id TEXT;

-- Backfill explícito por las dudas (el DEFAULT ya cubre INSERTs nuevos,
-- pero las filas previas a esta migración deben quedar como 'publicacion').
UPDATE appraisal_comparables SET kind = 'publicacion' WHERE kind IS NULL OR kind = '';

CREATE INDEX IF NOT EXISTS idx_appraisal_comparables_kind
  ON appraisal_comparables(appraisal_id, kind);
