-- 065_leads_meta_lead_id.sql
--
-- Los leads que entran por un formulario de Facebook/Instagram (webhook
-- `leadgen`) guardan el ID que les dio Meta. Sirve para dos cosas:
--   1. Dedup: Meta reintenta el webhook, y el mismo lead no tiene que entrar dos veces.
--   2. API de conversiones para CRM: cada cambio de etapa se le informa a Meta
--      con `user_data.lead_id`, que es la clave de match más fuerte.
--
-- TEXT y no INTEGER: son 15–17 dígitos y JS pierde precisión arriba de 16.

ALTER TABLE leads ADD COLUMN meta_lead_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_org_meta_lead_id
  ON leads(org_id, meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;
