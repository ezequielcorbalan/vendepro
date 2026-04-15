-- Track external reports (reports done outside the CRM)
ALTER TABLE properties ADD COLUMN last_external_report_at TEXT;
