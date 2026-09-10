# 🔔 Dominio: Notificaciones

In-app notifications. Cada usuario tiene su feed.

## Entidad

**`Notification`** (`domain/entities/notification.ts`):
- `id`, `org_id`, `user_id`
- `kind` (CHECK: `lead_assigned | task_overdue | reservation_update | system`)
- `title`, `body`, `link_url`
- `read` (0 | 1)
- `created_at`

Método: `markRead()`.

## Tabla D1

`notifications` — Índice: `(user_id, read)` para listar pendientes rápido.

## Eventos que generan notificaciones

- **`lead_assigned`** — cuando un lead se asigna a un agente
- **`task_overdue`** — cuando un evento de calendario o follow-up vence (job de cron en backend, pendiente de scheduler)
- **`reservation_update`** — cambios de stage en reservas que involucran al agente
- **`system`** — anuncios del sistema (deploys, mantenimiento, etc.)

(Actualmente algunos eventos se generan inline en los use cases; otros requieren scheduled task.)

## Quién escribe hoy

El único productor vivo es la acción **`notify_agent`** del motor de automatizaciones (`automation-executors.ts`) — o sea que la campana muestra algo solo si la org tiene automatizaciones activas con esa acción. Los eventos "inline en los use cases" listados arriba son aspiracionales: nadie los emite todavía.

## Use cases

- `GetUserNotificationsUseCase` — últimas 20 (leídas y no leídas; el frontend filtra `read`)
- `MarkNotificationReadUseCase` — agregado 10-sep-2026; el repo filtra por `user_id`

## Endpoints

[[API-admin]]:
- `GET /notifications` — devuelve el **array plano** de `toObject()` (campos `kind`, `link_url`, `read` — no `{notifications}` ni `type`/`link`/`urgency`)
- `PUT /notifications/:id/read` — persiste el descarte de la campana (10-sep-2026)

## Frontend

- Componente `NotificationBell.tsx` en el `Sidebar` (badge con count + dropdown), refresca cada 5 min
- **Arreglada el 10-sep-2026**: llamaba a api-crm (el endpoint vive en api-admin) y esperaba `{notifications}` con otros nombres de campo — la campana estuvo siempre vacía desde que existe. Ahora muestra solo las no leídas, mapea `kind`→urgencia (task_overdue=rojo, lead_assigned/reservation_update=amarillo, system=azul) y descartar marca leída en el backend.
- Click en notificación abre `link_url`

## Relacionados

- [[Dominio-Leads]] · [[Dominio-Reservas]] · [[Dominio-Calendario]]
- [[Dominio-Usuarios-Org]]
