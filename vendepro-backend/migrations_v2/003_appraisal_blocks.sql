-- Add new block columns to appraisals: Propuesta, Situación de mercado, Condiciones de trabajo, video links
-- public_slug already exists via 001_appraisals_extra_cols.sql — we only add the unique index here.

ALTER TABLE appraisals ADD COLUMN proposal_json TEXT;
ALTER TABLE appraisals ADD COLUMN market_situation_json TEXT;
ALTER TABLE appraisals ADD COLUMN work_conditions_json TEXT;
ALTER TABLE appraisals ADD COLUMN video_links_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appraisals_public_slug
  ON appraisals(public_slug)
  WHERE public_slug IS NOT NULL;
