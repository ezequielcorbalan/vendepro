# 💼 Dominio: Reservas (Transacciones)

Estapa final del pipeline: oferta aceptada → boleto → escritura → entregada.

## Pipeline

```
reservada → boleto → escritura → entregada
          ↘ cancelada
          ↘ rechazada
```

Definido en `domain/rules/reservation-rules.ts` con `canTransitionReservationStage(from, to)`.

## Entidad

**`Reservation`** (`domain/entities/reservation.ts`):
- `id`, `org_id`, `agent_id`
- Datos: `property_address`, `buyer_name`, `seller_name`
- Oferta: `offer_amount`, `offer_currency` (default USD)
- Fecha: `reservation_date`
- Estado: `stage`, `notes`
- Timestamps

Métodos: `advanceStage(newStage)` (con validación), `update(data)`.

## Tabla D1

`reservations` (ver [[DB-overview]]) — Índices: `(org_id, stage)`, `agent_id`.

> **Migración 064 (15-oct-2026)**: suma `property_id` (FK a `properties`), `acceptance_deadline`,
> `accepted_at`, `boleto_date`, `escritura_date` y `delivery_date`. Hitos calculados en
> `core/domain/rules/reservation-milestones.ts`; `GET /reservations?property_id=` los devuelve ya
> calculados. UI: `ReservationCard` en la ficha de la propiedad (antes la tabla no tenía pantalla).
> El propietario los ve con cuenta regresiva en su portal `/d/<token>`.
>
> **Reserva → propiedad "Reservada" (15-oct-2026)**: `MarkPropertyReservedUseCase` (core) pasa la
> propiedad a `reservada` cuando aparece una reserva: (1) un documento que la IA clasifica como
> `reserva` en la carpeta de Drive (barrido) o (2) subido por el portal del propietario, y (3) al cargar
> la reserva a mano desde la ficha (`POST /reservations` con `property_id`). Sólo desde etapas previas
> (propuesta, captada, documentación, publicada, suspendida, vencida), con `override` del pipeline, y
> deja `stage_history` con el motivo (`triggered_by` 'system' o 'user'). Nunca toca una reservada o
> cerrada. El selector de etapa manual de la ficha sigue igual. **Sin alertas por decisión del usuario**:
> los avisos de plazos (al agente o al propietario) van como recetas de Automatizaciones, si se quieren.
>
> Nota: el modelo es laxo — `property_id` es opcional (guarda también `property_address` como string). Esto es por diseño para soportar reservas de propiedades que no estaban en el sistema antes.

## Use cases

- `CreateReservation` + dispara evento marketing `reservation_created`
- `GetReservations` (filters: `stage`, `agent_id`)
- `AdvanceReservationStage` + dispara evento marketing por stage (`reservation_reservada`, `reservation_escriturada`, etc.)

## Endpoints

[[API-transactions]]:
- `GET /reservations`, `POST /reservations`
- `PUT /reservations/stage`, `PUT /reservations`
- `DELETE /reservations`

## Frontend

- `/reservas` — lista de propiedades reservadas (filtra `properties` con stage reservada o relaciona via reservation)
- `/vendidas`, `/alquiladas` — vistas similares por status

## Marketing integration

Cada cambio de stage puede disparar un evento conversion. La integración Meta CAPI mapea stages → eventos vía `stage_event_mappings`:

```
reservation_reservada → "InitiateCheckout"
reservation_escriturada → "Purchase"
```

Ver [[Dominio-Marketing]].

## Relacionados

- [[Dominio-Propiedades]] (cuando una reserva se concreta, la propiedad pasa a `vendida`)
- [[Dominio-Marketing]]
