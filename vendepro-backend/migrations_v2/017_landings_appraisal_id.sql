-- 017_landings_appraisal_id.sql
-- Links a landing to its source appraisal (populated when clone-as-tasacion clones the landing).
ALTER TABLE landings ADD COLUMN appraisal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_landings_appraisal ON landings(appraisal_id);
