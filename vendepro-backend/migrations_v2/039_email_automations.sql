-- ───────────────────────────────────────────────────────────────
-- 039_email_automations.sql — Automatizaciones de email (Fase 5)
-- Secuencias drip: varios emails espaciados en el tiempo. Se ingresa
-- por evento del CRM (lead_created, stage:*, appraisal_created) o por
-- inscripción manual de un segmento.
--
--   email_automations        → definición (pasos como JSON)
--   email_automation_enrollments → 1 fila por destinatario inscripto
--                                  (progreso: current_step + next_run_at)
--   email_automation_sends   → log por email efectivamente enviado
--
-- Idempotente: CREATE TABLE / INDEX IF NOT EXISTS
-- ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_automations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- draft | active | paused
  status TEXT NOT NULL DEFAULT 'draft',
  -- Disparador por evento del CRM. NULL = solo inscripción manual.
  -- Valores: 'lead_created' | 'stage:<stage>' | 'appraisal_created'
  trigger_event TEXT,
  -- Filtro opcional del disparador (JSON). Reservado; v1 no lo aplica.
  trigger_filter_json TEXT,
  -- Pasos de la secuencia (JSON array): [{ delay_hours, subject, preheader, html, text }]
  steps_json TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_automations_org ON email_automations(org_id);
-- Búsqueda del enroll por evento: solo activas con trigger.
CREATE INDEX IF NOT EXISTS idx_email_automations_trigger ON email_automations(trigger_event, status);

CREATE TABLE IF NOT EXISTS email_automation_enrollments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  contact_id TEXT,
  lead_id TEXT,
  -- Índice del próximo paso a enviar (0-based).
  current_step INTEGER NOT NULL DEFAULT 0,
  -- active | completed | cancelled | unsubscribed
  status TEXT NOT NULL DEFAULT 'active',
  -- Cuándo procesar el próximo paso (ISO). El cron barre <= now.
  next_run_at TEXT,
  enrolled_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_automation_enroll_org ON email_automation_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_enroll_auto ON email_automation_enrollments(automation_id);
-- Sweeper del cron: activas cuyo próximo paso ya venció.
CREATE INDEX IF NOT EXISTS idx_automation_enroll_due ON email_automation_enrollments(status, next_run_at);
-- No re-inscribir el mismo email en la misma automatización.
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_enroll_unique ON email_automation_enrollments(automation_id, email);

CREATE TABLE IF NOT EXISTS email_automation_sends (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  email TEXT NOT NULL,
  -- sent | failed
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  resend_email_id TEXT,
  sent_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_automation_sends_auto ON email_automation_sends(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_sends_enroll ON email_automation_sends(enrollment_id);
