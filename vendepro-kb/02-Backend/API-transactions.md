# 💼 API-transactions

Worker chico, solo reservas/transacciones.

| Campo | Valor |
|---|---|
| Path | `packages/api-transactions/` |
| Subdominio | `transactions.api.vendepro.com.ar` |
| Bindings | D1 |
| Secrets | `JWT_SECRET` |
| Middleware | cors, error-handler, auth |

## Endpoints

| Método | Path | Use case |
|---|---|---|
| GET | `/reservations` | GetReservationsUseCase (`?stage, ?agent_id`) |
| POST | `/reservations` | CreateReservationUseCase + marketing event `reservation_created` |
| PUT | `/reservations/stage` | AdvanceReservationStageUseCase + marketing event por stage (ej. `reservation_escriturada`) |
| PUT | `/reservations` | Update reserva (`{id, ...data}`) |
| DELETE | `/reservations` | Elimina (`?id`) |

Ver [[Dominio-Reservas]].

## Stages de reserva

`reservada → boleto → escritura → entregada` (con bifurcaciones a `cancelada` o `rechazada`). Cada transición dispara evento Meta CAPI / GA4 si está mapeado (ver [[Dominio-Marketing]]).
