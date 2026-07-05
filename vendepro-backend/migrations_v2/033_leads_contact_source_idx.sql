-- ───────────────────────────────────────────────────────────────
-- 033_leads_contact_source_idx.sql
-- Índice para el dedup de import por contacto + source_detail
-- (lookup de lead abierto en ImportLeadsUseCase)
-- Idempotente
-- ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leads_contact_source ON leads(contact_id, source_detail);
