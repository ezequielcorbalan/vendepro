-- ───────────────────────────────────────────────────────────────
-- 045_absorb_email_automations.sql
--
-- Absorbe las secuencias de email (`email_automations`, migración 039)
-- dentro del motor genérico de automatizaciones (043).
--
-- Equivalencia: una secuencia drip de N pasos es una automatización con
-- N acciones `send_email`. La única conversión real es la del tiempo:
--
--   email_automations → `delay_hours` RELATIVO al paso anterior
--   automations       → `delay_minutes` ABSOLUTO desde el disparo
--
-- por eso las acciones llevan la suma acumulada de los delays previos.
--
-- NO se borra ninguna tabla vieja: `email_automations`,
-- `email_automation_enrollments` y `email_automation_sends` quedan intactas
-- como respaldo y como historial de lo ya enviado. Si algo sale mal, alcanza
-- con borrar las filas 'mig-%' y volver a apuntar el cron al módulo viejo.
--
-- Idempotente: INSERT OR IGNORE con ids derivados del id original.
-- ───────────────────────────────────────────────────────────────

-- ── Definiciones ──────────────────────────────────────────────
INSERT OR IGNORE INTO automations (
  id, org_id, name, description, template_key, is_system,
  trigger_type, trigger_config, conditions, dedupe_scope,
  is_active, created_by, created_at, updated_at
)
SELECT
  'mig-' || ea.id,
  ea.org_id,
  ea.name,
  CASE
    WHEN ea.trigger_event IS NULL OR TRIM(ea.trigger_event) = ''
      THEN 'Migrada desde secuencias de email. La original se enviaba por inscripción manual de un segmento; revisá el disparador antes de activarla.'
    ELSE 'Migrada desde secuencias de email.'
  END,
  NULL,
  0,
  -- Mapeo de disparadores. El módulo viejo usaba 'lead_created',
  -- 'appraisal_created' y 'stage:<etapa>'.
  CASE
    WHEN ea.trigger_event = 'appraisal_created' THEN 'appraisal.created'
    WHEN ea.trigger_event LIKE 'stage:%'        THEN 'lead.stage_changed'
    ELSE 'lead.created'
  END,
  CASE
    WHEN ea.trigger_event LIKE 'stage:%'
      THEN json_object('to_stage', SUBSTR(ea.trigger_event, 7))
    ELSE '{}'
  END,
  '[]',
  -- Una secuencia de bienvenida no puede re-inscribir a la misma persona:
  -- el módulo viejo lo garantizaba con UNIQUE(automation_id, email).
  'once',
  -- Sólo sigue encendida la que estaba activa Y tenía disparador por evento.
  -- Las de inscripción manual quedan apagadas: su disparador es una
  -- aproximación y el admin tiene que confirmarlo.
  CASE
    WHEN ea.status = 'active'
     AND ea.trigger_event IS NOT NULL
     AND TRIM(ea.trigger_event) <> ''
    THEN 1 ELSE 0
  END,
  ea.created_by,
  ea.created_at,
  ea.updated_at
FROM email_automations ea
WHERE ea.steps_json IS NOT NULL
  AND json_valid(ea.steps_json)
  AND json_array_length(ea.steps_json) > 0;

-- ── Pasos → acciones `send_email` ─────────────────────────────
INSERT OR IGNORE INTO automation_actions (
  id, automation_id, org_id, order_index, action_type, action_config, delay_minutes
)
SELECT
  'mig-' || ea.id || '-' || step.key,
  'mig-' || ea.id,
  ea.org_id,
  step.key,
  'send_email',
  json_object(
    'subject',             COALESCE(json_extract(step.value, '$.subject'), ''),
    'body_html',           COALESCE(json_extract(step.value, '$.html'), ''),
    -- El módulo viejo siempre agregaba el link de baja y respondía al agente.
    'include_unsubscribe', json('true'),
    'reply_to_agent',      json('true')
  ),
  -- Suma acumulada: delay_hours es relativo al paso anterior, delay_minutes
  -- es absoluto desde el disparo.
  -- Clampeado al tope del dominio (180 días): una fila por encima haría
  -- fallar la hidratación de la entidad y rompería el listado entero.
  MIN(
    CAST(
      SUM(COALESCE(json_extract(step.value, '$.delay_hours'), 0)) OVER (
        PARTITION BY ea.id
        ORDER BY step.key
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) * 60 AS INTEGER
    ),
    259200
  )
FROM email_automations ea
JOIN json_each(ea.steps_json) AS step
WHERE ea.steps_json IS NOT NULL
  AND json_valid(ea.steps_json)
  AND json_array_length(ea.steps_json) > 0;

-- ── Corte del módulo viejo ────────────────────────────────────
-- Las inscripciones en vuelo se cancelan: a partir de acá el envío lo maneja
-- el motor nuevo, y dejarlas activas haría que la misma persona reciba el
-- mismo email dos veces (una por cada motor).
-- Lo ya enviado queda registrado en `email_automation_sends`, intacto.
UPDATE email_automation_enrollments
SET status = 'cancelled'
WHERE status = 'active';

-- Las definiciones viejas pasan a 'paused' para que quede explícito que ya
-- no son la fuente de verdad, sin perder su contenido.
UPDATE email_automations
SET status = 'paused'
WHERE status = 'active';
