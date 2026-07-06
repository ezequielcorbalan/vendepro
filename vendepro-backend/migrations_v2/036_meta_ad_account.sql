-- ───────────────────────────────────────────────────────────────
-- 036_meta_ad_account.sql — Meta Marketing API (campañas)
-- Agrega el Ad Account ID (act_XXXX) a la integración Meta para
-- poder leer insights de campañas (requiere token con ads_read).
-- ───────────────────────────────────────────────────────────────

ALTER TABLE meta_integration ADD COLUMN ad_account_id TEXT;
