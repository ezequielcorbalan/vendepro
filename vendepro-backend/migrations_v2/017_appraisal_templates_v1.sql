-- Migration 017 — Appraisal templates v1
-- Creates appraisal_templates, org_variables, appraisal_pdfs.
-- Extends appraisals with template_id, snapshot, synced_at, overrides.
-- Cleans up legacy Canva columns from appraisals and users.

-- ============================================================
-- Appraisal templates (sistema + custom por org, copy-on-write)
-- ============================================================
CREATE TABLE IF NOT EXISTS appraisal_templates (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preview_image_url TEXT,
  blocks_json TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  parent_template_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_org ON appraisal_templates(org_id, active);
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_kind ON appraisal_templates(kind);

-- ============================================================
-- Org variables (periódicas + custom)
-- ============================================================
CREATE TABLE IF NOT EXISTS org_variables (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL,
  label TEXT,
  namespace TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(org_id, key)
);
CREATE INDEX IF NOT EXISTS idx_org_variables_ns ON org_variables(org_id, namespace);

-- ============================================================
-- Appraisal PDFs (cache + quota tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS appraisal_pdfs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  appraisal_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_hash ON appraisal_pdfs(content_hash);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_org_month ON appraisal_pdfs(org_id, generated_at);
CREATE INDEX IF NOT EXISTS idx_appraisal_pdfs_appraisal ON appraisal_pdfs(appraisal_id);

-- ============================================================
-- Extend appraisals with template fields
-- ============================================================
ALTER TABLE appraisals ADD COLUMN template_id TEXT;
ALTER TABLE appraisals ADD COLUMN template_snapshot_json TEXT;
ALTER TABLE appraisals ADD COLUMN template_synced_at TEXT;
ALTER TABLE appraisals ADD COLUMN block_overrides_json TEXT;

-- ============================================================
-- Cleanup legacy Canva columns (Fase 1)
-- NOTE: Commented out because local D1 state may differ from production
-- (canva_template_id / canva_report_template_id may not exist locally).
-- Re-attempt these on production D1 after verifying columns exist.
-- ============================================================
-- ALTER TABLE appraisals DROP COLUMN canva_design_id;
-- ALTER TABLE appraisals DROP COLUMN canva_edit_url;
-- ALTER TABLE users DROP COLUMN canva_template_id;
-- ALTER TABLE users DROP COLUMN canva_report_template_id;
