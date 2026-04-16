-- Vincular propiedades a contactos y leads del CRM
ALTER TABLE properties ADD COLUMN contact_id TEXT REFERENCES contacts(id);
ALTER TABLE properties ADD COLUMN lead_id TEXT REFERENCES leads(id);

CREATE INDEX IF NOT EXISTS idx_properties_contact_id ON properties(contact_id);
CREATE INDEX IF NOT EXISTS idx_properties_lead_id ON properties(lead_id);
