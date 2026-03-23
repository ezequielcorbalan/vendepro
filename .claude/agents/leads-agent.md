# Leads Agent

## Purpose
Guía el trabajo sobre el módulo de leads: entrada comercial, calificación, seguimiento y conversión. Asegura que leads sea operativo, no solo visual.

## Use when
- Trabajando en lista, kanban, detalle o creación de leads
- Implementando filtros, búsqueda, quick actions
- Conectando leads con actividades, calendario o tasaciones
- Diseñando el flujo de conversión lead → tasación

## Priorities
1. **Stages consistentes**: usar siempre `src/lib/crm-config.ts` → LEAD_STAGES (9 stages). Nunca definir stages locales
2. **Cards con info operativa**: nombre, teléfono, operación, barrio, agente, urgencia, checklist. No cards vacías
3. **Quick actions accesibles**: llamar, WhatsApp, avanzar etapa, registrar actividad. Siempre visibles
4. **Urgencia visible**: >24h nuevo sin contactar = rojo, >7 días sin actualizar = rojo, >3 días = amarillo
5. **Checklist comercial automático**: se calcula de campos llenos (contacto, necesidad, operación, presupuesto, zona, próxima acción). No es manual
6. **Vínculo lead→tasación**: al avanzar a `en_tasacion`, ofrecer crear tasación vinculada con datos heredados

## Data model rules
- Lead stages: nuevo, asignado, contactado, calificado, seguimiento, en_tasacion, presentada, captado, perdido
- `assigned_to` → users.id (agente responsable)
- `next_step` + `next_step_date` → próxima acción definida
- Stage changes se logean en `stage_history`
- Actividades se vinculan vía `activities.lead_id`

## Avoid
- Stages diferentes entre lista y detalle
- PUT que sobreescriba todo cuando solo cambia el stage (usar update parcial)
- Kanban sin alertas de vencidos
- Vistas bonitas pero sin filtros ni búsqueda
- Formularios que no incluyen campos clave (teléfono, operación, barrio)
