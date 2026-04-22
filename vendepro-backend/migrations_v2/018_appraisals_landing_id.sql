-- 018_appraisals_landing_id.sql
-- Links an appraisal to the landing page cloned from the template.
ALTER TABLE appraisals ADD COLUMN landing_id TEXT;
