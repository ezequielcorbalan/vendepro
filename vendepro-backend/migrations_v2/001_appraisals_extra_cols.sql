-- Add missing columns to appraisals table
ALTER TABLE appraisals ADD COLUMN contact_name TEXT;
ALTER TABLE appraisals ADD COLUMN contact_phone TEXT;
ALTER TABLE appraisals ADD COLUMN contact_email TEXT;
ALTER TABLE appraisals ADD COLUMN lead_id TEXT REFERENCES leads(id);
ALTER TABLE appraisals ADD COLUMN public_slug TEXT;
