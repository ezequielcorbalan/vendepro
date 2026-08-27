-- ───────────────────────────────────────────────────────────────
-- 046_seguimiento_presentada_por_org.sql
--
-- Hasta acá, `AdvanceLeadStageUseCase` creaba a mano un evento de
-- seguimiento a +7 días cuando el lead pasaba a "presentada". Ese
-- comportamiento sale del código y pasa a ser una automatización, para que
-- el cliente pueda verlo, editarlo y apagarlo.
--
-- Para que sacar el hardcode NO cambie nada, esta migración activa la receta
-- `seguimiento_presentada` en cada org que ya existe. La receta hace
-- exactamente lo mismo que hacía el código: una tarea de calendario a los 7
-- días, sin emails.
--
-- El email de seguimiento a los 3 días es una receta aparte
-- (`email_post_tasacion`) y queda apagada: el hardcode no mandaba ningún
-- email, y activarlo tiene que ser una decisión explícita del cliente.
--
-- Idempotente: el índice único (org_id, template_key) evita duplicar, y el
-- INSERT ... SELECT filtra las orgs que ya la tengan.
-- ───────────────────────────────────────────────────────────────

-- Copia la receta de sistema como automatización propia de cada org, activa.
INSERT OR IGNORE INTO automations (
  id, org_id, name, description, template_key, is_system,
  trigger_type, trigger_config, conditions, dedupe_scope,
  is_active, created_by, created_at, updated_at
)
SELECT
  'auto-seg-presentada-' || o.id,
  o.id,
  sys.name,
  sys.description,
  sys.template_key,
  0,
  sys.trigger_type,
  sys.trigger_config,
  sys.conditions,
  sys.dedupe_scope,
  1,
  NULL,
  datetime('now'),
  datetime('now')
FROM organizations o
CROSS JOIN automations sys
WHERE sys.template_key = 'seguimiento_presentada'
  AND sys.is_system = 1
  AND NOT EXISTS (
    SELECT 1 FROM automations existing
    WHERE existing.org_id = o.id
      AND existing.template_key = 'seguimiento_presentada'
  );

-- Y sus acciones, con ids derivados de la org para que sean estables.
INSERT OR IGNORE INTO automation_actions (
  id, automation_id, org_id, order_index, action_type, action_config, delay_minutes
)
SELECT
  'act-seg-presentada-' || o.id || '-' || sys_act.order_index,
  'auto-seg-presentada-' || o.id,
  o.id,
  sys_act.order_index,
  sys_act.action_type,
  sys_act.action_config,
  sys_act.delay_minutes
FROM organizations o
CROSS JOIN automation_actions sys_act
WHERE sys_act.automation_id = 'sysauto-post-tasacion'
  AND EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = 'auto-seg-presentada-' || o.id
  );
