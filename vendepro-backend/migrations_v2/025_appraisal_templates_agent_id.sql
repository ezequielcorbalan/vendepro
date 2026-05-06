-- Add agent_id to appraisal_templates for agent-level templates
-- NULL = org-level or system template; set = agent's personal template
ALTER TABLE appraisal_templates ADD COLUMN agent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_appraisal_templates_agent ON appraisal_templates(agent_id, active);
