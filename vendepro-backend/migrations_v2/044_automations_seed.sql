-- ───────────────────────────────────────────────────────────────
-- 044_automations_seed.sql — Catálogo de recetas de automatización
--
-- Recetas de SISTEMA (org_id NULL, is_system = 1). El cliente las ve
-- en la galería y las activa con un click: eso copia la fila con su
-- org_id. Las de sistema no se editan; se edita la copia.
--
-- Idempotente: INSERT OR IGNORE con ids fijos.
-- ───────────────────────────────────────────────────────────────

-- ── 1. Bienvenida al lead ─────────────────────────────────────
-- La receta que motivó el feature: acuse de recibo inmediato + aviso
-- al agente. dedupe 'once' — nadie recibe dos bienvenidas nunca.
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-lead-bienvenida', NULL,
  'Bienvenida al lead',
  'Apenas entra un lead, le llega un email de acuse de recibo y el agente asignado recibe una notificación.',
  'lead_bienvenida', 1, 'lead.created', '{}', '[]', 'once', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-bienvenida-mail', 'sysauto-lead-bienvenida', NULL, 0, 'send_email',
  '{"subject":"Gracias por contactarte, {{lead.first_name|}}","body_html":"<p>Hola {{lead.first_name|}},</p><p>Gracias por contactarte con {{org.name}}. Recibimos tu consulta y en breve un agente se va a comunicar con vos.</p><p>Si necesitás algo urgente, respondé este mail y te contestamos.</p><p>Saludos,<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  0
),
(
  'sysact-bienvenida-notif', 'sysauto-lead-bienvenida', NULL, 1, 'notify_agent',
  '{"title":"Lead nuevo asignado","message":"{{lead.full_name}} entró por {{lead.source|carga manual}}. Recordá contactarlo dentro de las 24 horas.","target":"assigned_agent"}',
  0
);

-- ── 2. SLA de contacto (24h) ──────────────────────────────────
-- Hace cumplir la regla de negocio que ya estaba escrita pero que
-- nadie controlaba: el lead debe contactarse dentro de las 24h.
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-sla-contacto', NULL,
  'Alerta: lead sin contactar en 24h',
  'Si un lead lleva 24 horas sin pasar a "contactado", se le avisa al agente asignado y a los administradores.',
  'sla_contacto_24h', 1, 'lead.sin_contacto_24h', '{"horas":24}', '[]', 'once', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-sla-notif', 'sysauto-sla-contacto', NULL, 0, 'notify_agent',
  '{"title":"Lead sin contactar hace 24h","message":"{{lead.full_name}} sigue sin contactar. Tel: {{lead.phone|sin teléfono}}","target":"assigned_agent"}',
  0
),
(
  'sysact-sla-admin', 'sysauto-sla-contacto', NULL, 1, 'notify_agent',
  '{"title":"SLA incumplido: lead sin contactar","message":"{{lead.full_name}} lleva 24h sin contacto. Agente: {{agent.full_name|sin asignar}}","target":"admins"}',
  0
);

-- ── 3. Lead frío a los 7 días ─────────────────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-lead-frio', NULL,
  'Lead sin respuesta a los 7 días',
  'Si un lead lleva 7 días sin actividad, se registra en su historial y se avisa al agente para decidir si darlo por perdido.',
  'lead_frio_7d', 1, 'lead.sin_respuesta_7d', '{"dias":7}', '[]', 'once', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-frio-notif', 'sysauto-lead-frio', NULL, 0, 'notify_agent',
  '{"title":"Lead sin respuesta hace 7 días","message":"{{lead.full_name}} no registra actividad hace una semana. ¿Lo seguimos o lo damos por perdido?","target":"assigned_agent"}',
  0
),
(
  'sysact-frio-log', 'sysauto-lead-frio', NULL, 1, 'log_activity',
  '{"activity_type":"automatizacion","notes":"7 días sin actividad registrada. Alerta automática enviada al agente."}',
  0
);

-- ── 4. Seguimiento post-tasación ──────────────────────────────
-- Reemplaza el seguimiento que estaba hardcodeado en advance-lead-stage.
-- Se seedea apagada: se enciende recién cuando la cola de diferidos esté
-- en producción, para no dejar una ventana sin el seguimiento.
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-post-tasacion', NULL,
  'Seguimiento post-tasación',
  'Cuando la tasación pasa a "presentada": email al cliente a los 3 días y tarea de llamado al agente a los 7.',
  'seguimiento_presentada', 1, 'lead.stage_changed', '{"to_stage":"presentada"}', '[]', 'daily', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-post-mail', 'sysauto-post-tasacion', NULL, 0, 'send_email',
  '{"subject":"¿Qué te pareció la tasación, {{lead.first_name|}}?","body_html":"<p>Hola {{lead.first_name|}},</p><p>Hace unos días te presentamos la tasación de tu propiedad. Queríamos saber si pudiste revisarla y si te quedó alguna duda.</p><p>Estamos para ayudarte cuando quieras avanzar.</p><p>{{agent.full_name|}}<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  4320
),
(
  'sysact-post-tarea', 'sysauto-post-tasacion', NULL, 1, 'create_calendar_event',
  '{"title":"Seguimiento: {{lead.full_name}}","description":"Seguimiento automático post-presentación de la tasación.","event_type":"seguimiento","due_in_days":7}',
  0
);

-- ── 5. Propiedad publicada ────────────────────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-prop-publicada', NULL,
  'Aviso de publicación al propietario',
  'Cuando la propiedad pasa a "publicada", el propietario recibe un email con el link del reporte público.',
  'propiedad_publicada', 1, 'property.stage_changed', '{"to_stage":"publicada"}', '[]', 'daily', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES (
  'sysact-publicada-mail', 'sysauto-prop-publicada', NULL, 0, 'send_email',
  '{"subject":"Tu propiedad ya está publicada","body_html":"<p>Hola {{contact.first_name|}},</p><p>Te contamos que <strong>{{property.title}}</strong> ({{property.address}}) ya está publicada y visible para compradores.</p><p>Podés seguir su rendimiento acá: <a href=\"{{property.public_url}}\">ver reporte</a></p><p>{{agent.full_name|}}<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  0
);

-- ── 6. Tasación solicitada ────────────────────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-en-tasacion', NULL,
  'Confirmación de tasación en curso',
  'Cuando el lead pasa a "en tasación", se le explica por email qué sigue y en cuánto tiempo.',
  'tasacion_en_curso', 1, 'lead.stage_changed', '{"to_stage":"en_tasacion"}', '[]', 'daily', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES (
  'sysact-tasacion-mail', 'sysauto-en-tasacion', NULL, 0, 'send_email',
  '{"subject":"Estamos tasando tu propiedad","body_html":"<p>Hola {{lead.first_name|}},</p><p>Ya estamos trabajando en la tasación de tu propiedad. Analizamos el mercado de la zona, propiedades comparables y las características puntuales de la tuya.</p><p>En los próximos días te vamos a presentar el informe completo.</p><p>{{agent.full_name|}}<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  0
);

-- ── 7. Lead de portal → asignación automática ─────────────────
-- Los leads de portal entran sin dueño; el round-robin evita que
-- queden esperando a que alguien los levante a mano.
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-lead-portal', NULL,
  'Lead de portal: asignar y responder',
  'Los leads que entran por ZonaProp o Argenprop se reparten entre los agentes activos y reciben una respuesta inmediata.',
  'lead_portal', 1, 'lead.created',
  '{}',
  '[{"field":"lead.source","op":"in","value":["zonaprop","argenprop","mercadolibre"]}]',
  'once', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-portal-asignar', 'sysauto-lead-portal', NULL, 0, 'assign_lead',
  '{"mode":"round_robin","only_if_unassigned":true}',
  0
),
(
  'sysact-portal-mail', 'sysauto-lead-portal', NULL, 1, 'send_email',
  '{"subject":"Recibimos tu consulta","body_html":"<p>Hola {{lead.first_name|}},</p><p>Recibimos tu consulta sobre la propiedad publicada. Un agente de {{org.name}} se va a comunicar con vos a la brevedad para darte toda la información.</p><p>Saludos,<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  0
);

-- ── 8. Publicación por vencer ─────────────────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-publicacion-vence', NULL,
  'Aviso de publicación por vencer',
  'Siete días antes de que venza la autorización de la propiedad, se le avisa al agente para renovarla.',
  'publicacion_por_vencer', 1, 'property.publicacion_vencida', '{"dias_antes":7}', '[]', 'once', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES (
  'sysact-vence-notif', 'sysauto-publicacion-vence', NULL, 0, 'notify_agent',
  '{"title":"Publicación por vencer","message":"La autorización de {{property.title}} ({{property.address}}) vence en 7 días. Coordiná la renovación con el propietario.","target":"assigned_agent"}',
  0
);

-- ── 9. Lead calificado → agendar visita ───────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-lead-calificado', NULL,
  'Lead calificado: agendar visita',
  'Cuando el lead pasa a "calificado", se le crea al agente una tarea de visita de captación para los próximos 3 días.',
  'lead_calificado_visita', 1, 'lead.stage_changed', '{"to_stage":"calificado"}', '[]', 'daily', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES (
  'sysact-calificado-visita', 'sysauto-lead-calificado', NULL, 0, 'create_calendar_event',
  '{"title":"Visita de captación: {{lead.full_name}}","description":"Coordinar visita con {{lead.full_name}} — Tel: {{lead.phone|sin teléfono}}","event_type":"visita_captacion","due_in_days":3}',
  0
);

-- ── 10. Lead captado → felicitar y avisar ─────────────────────
INSERT OR IGNORE INTO automations
  (id, org_id, name, description, template_key, is_system, trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by)
VALUES (
  'sysauto-lead-captado', NULL,
  'Captación cerrada',
  'Cuando el lead pasa a "captado", se le agradece al propietario por email y se avisa a los administradores.',
  'lead_captado', 1, 'lead.stage_changed', '{"to_stage":"captado"}', '[]', 'daily', 0, NULL
);

INSERT OR IGNORE INTO automation_actions
  (id, automation_id, org_id, order_index, action_type, action_config, delay_minutes)
VALUES
(
  'sysact-captado-mail', 'sysauto-lead-captado', NULL, 0, 'send_email',
  '{"subject":"¡Bienvenido a {{org.name}}!","body_html":"<p>Hola {{lead.first_name|}},</p><p>Gracias por confiarnos la comercialización de tu propiedad. A partir de ahora vas a recibir reportes periódicos con el rendimiento de la publicación y las visitas.</p><p>Cualquier duda, escribinos.</p><p>{{agent.full_name|}}<br>{{org.name}}</p>","include_unsubscribe":true,"reply_to_agent":true}',
  0
),
(
  'sysact-captado-admin', 'sysauto-lead-captado', NULL, 1, 'notify_agent',
  '{"title":"Captación cerrada","message":"{{agent.full_name|Un agente}} captó a {{lead.full_name}}.","target":"admins"}',
  0
);
