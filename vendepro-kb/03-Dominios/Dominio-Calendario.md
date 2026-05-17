# 📅 Dominio: Calendario

Calendario operativo del agente. Cada evento se linkea a una entidad del CRM (lead, contact, property, appraisal, reservation).

## Tipos de evento

9 tipos definidos en `domain/value-objects/event-type.ts` y en `lib/crm-config.ts → EVENT_TYPES`:

- `llamada`
- `reunion`
- `visita_captacion`
- `visita_comprador`
- `tasacion`
- `seguimiento`
- `admin`
- `firma`
- `otro`

Cada tipo tiene color, ícono y label asociados en el frontend.

## Estados

- **Pending**: normal
- **Completed**: faded + check
- **Overdue**: borde rojo + tinte ámbar + badge "VENCIDO"
- **Cancelled**: tachado + faded

## Entidad

**`CalendarEvent`** (`domain/entities/calendar-event.ts`):
- `id`, `org_id`, `agent_id`, `title`
- `event_type`, `start_at`, `end_at`, `all_day`, `description`, `color`
- Links: `lead_id`, `contact_id`, `property_id`, `appraisal_id`, `reservation_id`
- `completed` (0|1)
- Timestamps

Métodos: `isOverdue(now)`, `toggleComplete()`, `reschedule(start, end)`.

## Tabla D1

`calendar_events` — Índices: `(org_id, start_at)`, `agent_id`.

## Use cases

- `CreateCalendarEvent`
- `GetCalendarEvents` (filters: agent, start, end, event_type)
- `RescheduleEvent`
- `ToggleEventComplete`
- `GetTodayEvents` (en analytics)
- `GetPendingFollowups` (en analytics)

## Endpoints

[[API-crm]]:
- `GET/POST/DELETE /calendar`
- `PUT /calendar/complete`
- `PUT /calendar/reschedule`

[[API-analytics]]:
- `/dashboard` incluye `getTodayEvents` y `getPendingFollowups`

## Frontend

- `/calendario` — vista principal
- Componentes: 4 vistas (mes / semana / día / agenda)
  - Mobile default: agenda
  - Desktop default: semana
- Quick actions inline: completar, llamar, WhatsApp, reprogramar, eliminar (call/WhatsApp deshabilitados si no hay phone)

## Reglas operacionales

- Eventos vencidos: badge "VENCIDO" rojo
- Reglas en `lib/crm-config.ts → EVENT_TYPES` centralizan colores/íconos/labels
- Cualquier evento DEBE linkearse a una entidad CRM (regla de [[Reglas-criticas]])

## Relacionados

- [[Dominio-Leads]] · [[Dominio-Contactos]] · [[Dominio-Propiedades]] · [[Dominio-Tasaciones]] · [[Dominio-Reservas]]
- [[Dominio-Actividades]] (los eventos completados a veces generan actividades)
