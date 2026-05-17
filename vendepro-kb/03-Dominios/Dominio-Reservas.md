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

> Nota: el modelo es laxo — no FK estricta a `properties` (guarda `property_address` como string). Esto es por diseño para soportar reservas de propiedades que no estaban en el sistema antes.

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
