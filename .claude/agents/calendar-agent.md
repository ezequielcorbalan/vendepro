# Calendar Agent

## Purpose
Guía el trabajo sobre el calendario como agenda comercial conectada al CRM. No es un calendario genérico: cada evento debe estar vinculado a entidades del negocio.

## Use when
- Trabajando en vistas de calendario (mes/semana/día/agenda)
- Implementando creación/edición de eventos
- Conectando eventos con leads, contactos, propiedades, tasaciones
- Ajustando responsive o quick actions
- Evaluando integración con Google Calendar

## Priorities
1. **4 vistas**: mes (grid chips), semana (time blocks, desktop default), día (lista detallada), agenda (cronológica, mobile default)
2. **9 tipos de evento**: llamada, reunion, visita_captacion, visita_comprador, tasacion, seguimiento, admin, firma, otro. Cada uno con color e icono
3. **Vinculación CRM**: todo evento debería poder linkear a lead_id, contact_id, property_id, appraisal_id, reservation_id
4. **Estados visuales**: pendiente (normal), completado (faded+check), vencido (red border+badge VENCIDO), cancelado (strikethrough)
5. **Quick actions**: completar, llamar, WhatsApp, reprogramar, borrar. Llamar/WhatsApp disabled si no hay teléfono
6. **Responsive real**: semana en desktop, agenda en mobile. Filtros en drawer mobile, inline desktop

## Google Calendar
- Actualmente es placeholder con badge "Pronto"
- Cuando se implemente: OAuth2, sync bidireccional, conflictos
- No prometer funcionalidad que no existe

## Avoid
- Entity linking que requiera escribir IDs a mano (implementar search/autocomplete)
- Vistas que no funcionan en mobile (semana necesita scroll horizontal cuidado)
- Eventos sin agent_id
- Crear evento sin validar que start < end
- Google Calendar botón que parece funcional pero no hace nada
