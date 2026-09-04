-- ───────────────────────────────────────────────────────────────
-- 050_recontacto_no_captado.sql
--
-- Un lead que no se captó no es basura: el propietario sigue queriendo
-- vender y en unos meses puede volver a estar disponible (se le cayó la
-- operación con la otra inmobiliaria, bajó el precio, se apuró). Hasta acá
-- ese lead pasaba a `perdido` y no lo miraba nadie nunca más.
--
-- La etapa `perdido` del pipeline vendedor ahora se muestra como "No
-- captado" (frontend, `lib/crm-config.ts`); la clave no cambia porque está
-- en `leads.stage`, en `stage_history` y en las políticas de sync.
--
-- Esta migración agrega la receta que cierra el circuito: cuando un lead
-- vendedor pasa a "no captado", se le agendan al agente dos tareas de
-- recontacto — al mes y a los cuatro meses. Son tareas internas de
-- calendario: no le llega nada al cliente.
--
-- Se activa en las orgs existentes porque es el comportamiento pedido, no
-- un opt-in; queda editable y apagable desde Configuración →
-- Automatizaciones como cualquier otra.
--
-- Idempotente: INSERT OR IGNORE con ids fijos + el índice único
-- (org_id, template_key).
-- ───────────────────────────────────────────────────────────────

-- ── 1. Receta de sistema (galería) ────────────────────────────
-- dedupe 'once': un lead no se recontacta dos veces por el mismo cierre.
-- Si el lead se reabre y se vuelve a perder, la tarea la agenda el agente.
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-recontacto-no-captado', NULL,
  'Recontacto de no captados',
  'Cuando un lead pasa a "no captado", se agendan dos tareas de seguimiento: al mes y a los cuatro meses, para ver si la propiedad se vendió o sigue disponible.',
  'recontacto_no_captado', 1, 'lead.stage_changed', '{"to_stage":"perdido"}',
  -- Sólo captación: en el pipeline comprador "perdido" es perdido de verdad.
  '[{"field":"lead.pipeline","op":"neq","value":"comprador"}]', 'once', 0, NULL
);

-- Las dos tareas salen del mismo disparo (delay 0) y se diferencian por
-- `due_in_days`: el motor agenda el evento a esa distancia del disparo.
INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-recontacto-30d', 'sysauto-recontacto-no-captado', NULL, 0, 'create_calendar_event',
  '{"title":"Recontactar: {{lead.full_name}}","description":"No captado hace un mes. Preguntar si la propiedad sigue en venta o si ya se vendió.","event_type":"seguimiento","due_in_days":30}',
  0
),
(
  'sysact-recontacto-120d', 'sysauto-recontacto-no-captado', NULL, 1, 'create_calendar_event',
  '{"title":"Recontactar: {{lead.full_name}}","description":"No captado hace cuatro meses. Segundo intento: si no se vendió, la propiedad puede estar disponible de nuevo.","event_type":"seguimiento","due_in_days":120}',
  0
);

-- ── 2. Activarla en las orgs que ya existen ───────────────────
-- Mismo patrón que 046: se copia la receta de sistema con el org_id, activa.
INSERT OR IGNORE INTO automations (
  id, org_id, name, description, template_key, is_system,
  trigger_type, trigger_config, conditions, dedupe_scope,
  is_active, created_by, created_at, updated_at
)
SELECT
  'auto-recontacto-no-captado-' || o.id,
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
WHERE sys.template_key = 'recontacto_no_captado'
  AND sys.is_system = 1
  AND NOT EXISTS (
    SELECT 1 FROM automations existing
    WHERE existing.org_id = o.id
      AND existing.template_key = 'recontacto_no_captado'
  );

INSERT OR IGNORE INTO automation_actions (
  id, automation_id, org_id, order_index, action_type, action_config, delay_minutes
)
SELECT
  'act-recontacto-no-captado-' || o.id || '-' || sys_act.order_index,
  'auto-recontacto-no-captado-' || o.id,
  o.id,
  sys_act.order_index,
  sys_act.action_type,
  sys_act.action_config,
  sys_act.delay_minutes
FROM organizations o
CROSS JOIN automation_actions sys_act
WHERE sys_act.automation_id = 'sysauto-recontacto-no-captado'
  AND EXISTS (
    SELECT 1 FROM automations a
    WHERE a.id = 'auto-recontacto-no-captado-' || o.id
  );
