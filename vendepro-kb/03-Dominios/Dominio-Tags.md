# 🏷️ Dominio: Tags

Etiquetas reutilizables para leads. Relación M:N.

## Entidades

- **`Tag`** (`domain/entities/tag.ts`): `id`, `org_id`, `name`, `color` (hex, default `#6b7280`), `is_default`, `created_at`
- Tabla intermedia `lead_tags` (`lead_id`, `tag_id`)

## Tablas D1

- `tags` — un row por tag
- `lead_tags` — composite PK `(lead_id, tag_id)`

Seeds en migration 000:
- `tag_propietario`, `tag_comprador`, `tag_inversor`, `tag_aliado` (is_default=1)

Hay también un set frontend en `crm-config.ts → DEFAULT_TAGS` con los mismos 4.

## Use cases

- `CreateTagUseCase`
- (lectura/borrado en queries inline en las rutas)

## Endpoints

[[API-crm]]:
- `GET /tags`, `POST /tags`, `DELETE /tags`
- `GET /lead-tags?lead_id=`, `POST /lead-tags`, `DELETE /lead-tags`

## Frontend

- Se aplican desde el detalle del lead (`/leads/[id]`)
- También sirven para filtrar el kanban en `/leads`

## Relacionados

- [[Dominio-Leads]]
