-- ───────────────────────────────────────────────────────────────
-- 043_automations.sql — Motor de automatizaciones
--
-- Una automatización = 1 trigger + N condiciones (AND) + N acciones
-- ordenadas, cada una con un delay opcional.
--
--   EVENTO  →  CONDICIONES  →  ACCIONES
--
-- Ejecución: todo evento persiste sus acciones como filas en
-- `automation_jobs` (cola durable). El drenaje ocurre inline vía
-- ctx.waitUntil cuando el worker tiene los secrets, y el cron de
-- api-crm (*/15) es la red de seguridad + el que ejecuta los delays.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- ───────────────────────────────────────────────────────────────

-- ── Definición ────────────────────────────────────────────────
-- org_id NULL + is_system = 1 → receta del catálogo (mismo patrón
-- que appraisal_templates). El cliente la "activa" y eso copia la
-- fila con su org_id.
CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  org_id TEXT,                                   -- NULL sólo para recetas de sistema
  name TEXT NOT NULL,
  description TEXT,
  -- Clave de la receta de origen ('lead_bienvenida', 'sla_contacto_24h'...).
  -- Permite versionar el catálogo y evitar que el cliente active dos veces la misma.
  template_key TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  -- 'lead.created' | 'lead.stage_changed' | 'lead.assigned' | 'contact.created'
  -- | 'property.stage_changed' | 'appraisal.created'
  -- | 'lead.sin_contacto_24h' | 'lead.sin_respuesta_7d' | 'property.publicacion_vencida'
  trigger_type TEXT NOT NULL,
  -- JSON con el detalle del trigger. Ej: {"to_stage":"nuevo"} o {"dias":7}
  trigger_config TEXT NOT NULL DEFAULT '{}',
  -- JSON array de condiciones AND: [{"field":"source","op":"eq","value":"web"}]
  conditions TEXT NOT NULL DEFAULT '[]',
  -- Cada cuánto puede volver a correr sobre la misma entidad:
  --   'daily'  → una vez por día (default; sirve para cambios de etapa)
  --   'once'   → una sola vez en la vida (secuencias de bienvenida / drip)
  --   'always' → sin deduplicación
  dedupe_scope TEXT NOT NULL DEFAULT 'daily',
  is_active INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Lookup caliente del motor: por org + trigger, sólo activas.
CREATE INDEX IF NOT EXISTS idx_automations_trigger
  ON automations(org_id, trigger_type, is_active);
-- Catálogo de recetas de sistema.
CREATE INDEX IF NOT EXISTS idx_automations_system
  ON automations(is_system, template_key);
-- Una org no puede activar dos veces la misma receta.
CREATE UNIQUE INDEX IF NOT EXISTS idx_automations_org_template
  ON automations(org_id, template_key) WHERE template_key IS NOT NULL AND org_id IS NOT NULL;

-- ── Acciones ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_actions (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  org_id TEXT,                                   -- NULL para acciones de recetas de sistema
  order_index INTEGER NOT NULL DEFAULT 0,
  -- 'send_email' | 'notify_agent' | 'send_internal_email' | 'create_calendar_event'
  -- | 'log_activity' | 'assign_lead' | 'change_stage' | 'add_tag' | 'send_webhook'
  action_type TEXT NOT NULL,
  -- JSON con la config de la acción. Ej send_email:
  -- {"subject":"Gracias {{lead.full_name}}","body_html":"...","include_unsubscribe":true}
  action_config TEXT NOT NULL DEFAULT '{}',
  -- 0 = inmediata. >0 = diferida, la ejecuta el cron cuando vence.
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_actions_automation
  ON automation_actions(automation_id, order_index);

-- ── Log de ejecuciones ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  entity_type TEXT,                              -- 'lead' | 'contact' | 'property' | 'appraisal'
  entity_id TEXT,
  -- 'pending' | 'success' | 'partial' | 'failed' | 'skipped'
  status TEXT NOT NULL DEFAULT 'pending',
  -- Por qué no corrió: 'conditions_not_met' | 'duplicate' | 'rate_limited'
  -- | 'suppressed' | 'max_depth' | 'no_recipient'
  skip_reason TEXT,
  -- Snapshot JSON del payload del evento (para debug y para el dry-run).
  payload TEXT,
  -- Profundidad de encadenamiento. >= 1 significa que este run lo disparó
  -- otra automatización; el motor no vuelve a encadenar (anti-loop).
  depth INTEGER NOT NULL DEFAULT 0,
  -- Clave de deduplicación: automation_id + entity_id + evento + día.
  dedupe_key TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation
  ON automation_runs(automation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_org
  ON automation_runs(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_entity
  ON automation_runs(entity_type, entity_id);
-- Guarda anti-duplicado: el mismo lead no recibe dos veces el mismo mail.
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_runs_dedupe
  ON automation_runs(dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Resultado por acción dentro de un run.
CREATE TABLE IF NOT EXISTS automation_run_actions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  -- 'pending' | 'success' | 'failed' | 'skipped'
  status TEXT NOT NULL DEFAULT 'pending',
  -- Detalle útil para el UI: destinatario del mail, id del evento creado, etc.
  result TEXT,
  error TEXT,
  executed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_run_actions_run
  ON automation_run_actions(run_id);

-- ── Cola durable ──────────────────────────────────────────────
-- Una fila por acción a ejecutar. run_at = ahora + delay_minutes.
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  run_action_id TEXT NOT NULL,
  automation_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  -- Snapshot JSON del contexto (entidad + evento) en el momento del trigger.
  -- Congelado a propósito: si el lead cambia entre el disparo y el envío
  -- diferido, el mail usa los datos del momento del disparo.
  context TEXT NOT NULL DEFAULT '{}',
  -- Snapshot JSON de la config de la acción. Congelarla evita que un job
  -- diferido falle porque la automatización se editó o se borró, y hace que
  -- el log refleje exactamente lo que se envió.
  action_config TEXT NOT NULL DEFAULT '{}',
  run_at TEXT NOT NULL,
  -- 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  -- Lease para que dos drenajes concurrentes (waitUntil + cron) no tomen
  -- el mismo job. Se setea al pasar a 'running'.
  locked_until TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Query del drenaje: pendientes vencidos, más viejos primero.
CREATE INDEX IF NOT EXISTS idx_automation_jobs_due
  ON automation_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_run
  ON automation_jobs(run_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_org
  ON automation_jobs(org_id, created_at);
