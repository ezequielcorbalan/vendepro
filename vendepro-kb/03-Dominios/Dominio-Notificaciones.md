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

## Use cases

- `GetUserNotificationsUseCase`
- `MarkAsRead` (port pero no use case formal)

## Endpoints

[[API-admin]]:
- `GET /notifications`

## Frontend

- Componente `NotificationBell.tsx` en el `Sidebar` (badge con count + dropdown)
- Click en notificación abre `link_url`

## Relacionados

- [[Dominio-Leads]] · [[Dominio-Reservas]] · [[Dominio-Calendario]]
- [[Dominio-Usuarios-Org]]
