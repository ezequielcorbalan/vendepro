-- 062_aviso_autorizacion.sql
-- Aviso de autorización por vencer: texto con los días reales.
--
-- La receta 'publicacion_por_vencer' (migración 044) decía "vence en 7 días"
-- fijo, aunque los días de anticipación se configuran. Ahora el contexto de
-- propiedad trae {{property.auth_expires_at}} y {{property.auth_days_left}}.
--
-- Se reescriben la receta de sistema y las copias de las orgs que todavía
-- tienen el texto original: si alguien ya lo editó a mano, no se toca.
-- Idempotente: correrla dos veces no cambia nada.

UPDATE automations
SET name = 'Aviso de autorización por vencer',
    description = 'Antes de que venza la autorización de venta de la propiedad, se le avisa al agente para renovarla. Si se renueva, vuelve a avisar para el vencimiento nuevo.',
    updated_at = datetime('now')
WHERE template_key = 'publicacion_por_vencer'
  AND name = 'Aviso de publicación por vencer';

UPDATE automation_actions
SET action_config = json_set(
      action_config,
      '$.title', 'Autorización por vencer',
      '$.message', 'La autorización de {{property.title}} ({{property.address}}) vence el {{property.auth_expires_at}}: faltan {{property.auth_days_left}} días. Coordiná la renovación con el propietario.'
    )
WHERE action_type = 'notify_agent'
  AND json_extract(action_config, '$.message') = 'La autorización de {{property.title}} ({{property.address}}) vence en 7 días. Coordiná la renovación con el propietario.'
  AND automation_id IN (SELECT id FROM automations WHERE template_key = 'publicacion_por_vencer');
