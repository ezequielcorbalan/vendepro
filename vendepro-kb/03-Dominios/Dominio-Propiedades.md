# 🏠 Dominio: Propiedades

Listing inmobiliario gestionado: captación, publicación, comercialización, venta/alquiler.

## Pipeline comercial (commercial_stage)

```
captada → documentacion → publicada → reservada → vendida
                                    ↘ suspendida ↘ vencida → archivada
```

Definido en `domain/value-objects/property-stage.ts` con transiciones validadas.

Para **alquileres** los stages son: captacion, publicada, con_interesados, alquilada, suspendida.

## Status (estado operativo)

`active | sold | suspended | archived | inactive` — independiente del commercial_stage. Definido en `domain/rules/property-rules.ts` con `canTransitionPropertyStatus(from, to)`.

## Entidad

- **`Property`** (`domain/entities/property.ts`)

Campos principales:
- Identificación: `id`, `org_id`, `public_slug`, `address`, `neighborhood`, `city`, `property_type` (departamento|casa|ph|local|terreno|oficina)
- Comerciales: `asking_price`, `currency` (USD|ARS), `operation_type` + `operation_type_id`, `commercial_stage` + `commercial_stage_id`, `status` + `status_id`
- Datos: `rooms`, `size_m2`
- Propietario: `owner_name`, `owner_phone`, `owner_email`, `contact_id`
- Origen: `lead_id` (de qué lead vino), `agent_id` (responsable)
- Mandato: `auth_start_date`, `auth_duration_days` (default 180)
- Documentación: `doc_status_json` (checklist de documentos)
- Resultado: `sold_price`, `sold_date`, `days_on_market`
- Media: `cover_photo`
- External tracking: `last_external_report_at`

## Catálogos normalizados (D1)

Tres tablas catálogo creadas en migration 005:
- `operation_types` (venta, alquiler)
- `commercial_stages` (por operation_type)
- `property_statuses` (por operation_type)

Se exponen vía `GET /property-config` en [[API-properties]].

## Sub-entidades

- **`property_photos`** — galería con orden, key R2
- **`property_price_history`** — historial de cambios de precio con razón (también la tabla legacy `price_history`)
- **`competitor_links`** — links a propiedades competidoras
- **`property_visit_forms`** — ficha post-visita (ver [[Dominio-Visit-forms]])

## Use cases

`packages/core/src/application/use-cases/properties/`:
- CRUD: `CreateProperty`, `GetProperties`, `GetPropertyDetail`, `UpdateProperty`, `DeleteProperty`
- Status/stage/price: `UpdatePropertyStage`, `UpdatePropertyStatus`, `UpdatePropertyPrice`
- Catálogos: `GetPropertyCatalogs`
- Fotos: `UploadPropertyPhoto`, `DeletePropertyPhoto`, `ReorderPropertyPhotos`
- External: `MarkExternalReport`, `ClearExternalReport`

## Endpoints

[[API-properties]]:
- `GET/POST /properties`, `GET/PUT/DELETE /properties/:id`
- `PUT /properties/:id/{stage,price,status}`
- `GET /properties/:id/price-history`, `POST /properties/:id/price-change`
- `POST/DELETE /properties/:id/external-report`
- `GET /photo/:key` (público), `POST /photos`, `DELETE /photos/:id`, `PUT /photos/reorder`
- `GET /property-config`

## Frontend

- `/propiedades` — tabla con filtros
- `/propiedades/nueva`
- `/propiedades/[id]` — detalle + fotos + autorización + checklist docs + reportes
- `/propiedades/[id]/editar`
- `/propiedades/[id]/reportes`, `/propiedades/[id]/reportes/nuevo`
- `/propiedades/pipeline` — kanban drag-drop
- `/reservas`, `/vendidas`, `/alquiladas` — vistas filtradas
- Página pública: `/r/[slug]` (reporte público)

Componentes: `PropertyFilters`, `AuthorizationWidget`, `DocChecklistWidget`, `PriceHistoryWidget`, `ReportsListWidget`, `VisitFormsSection`, `PropertySelector`.

## Relacionados

- [[Dominio-Contactos]] (`contact_id` = propietario)
- [[Dominio-Leads]] (`lead_id` origen)
- [[Dominio-Tasaciones]] (una tasación puede preceder o seguir a la captación)
- [[Dominio-Reportes]] (reportes mensuales de portales por propiedad)
- [[Dominio-Visit-forms]] (formularios y fichas de visita)
- [[Dominio-Reservas]] (cuando se reserva)
