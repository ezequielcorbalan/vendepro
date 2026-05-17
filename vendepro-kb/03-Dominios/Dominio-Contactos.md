# 👤 Dominio: Contactos

Base de personas en la org: propietarios, compradores, inversores, aliados. Distinto de un Lead (que es un proceso comercial).

## Entidad

- **`Contact`** (`domain/entities/contact.ts`)

Campos:
- `id` (prefijo `ct_`), `org_id`
- `full_name`, `phone`, `email`
- `contact_type` (propietario|comprador|inquilino|inversor|aliado|otro — default `propietario`)
- `neighborhood` (zona donde vive)
- `notes`, `source`
- `agent_id` (responsable)
- `created_at`

## Tabla D1

`contacts` (ver [[DB-overview]]):
- Índices: `(org_id)`, `agent_id`
- FKs: `org_id`, `agent_id → users(id)`

Los contactos se crean automáticamente desde leads en la migration `003_leads_contact_id.sql` (backfill) y en `CreateLeadWithContactUseCase`.

## Use cases

- `CreateContactUseCase`
- `GetContactsUseCase` — filtros `search`, `agent_id`
- `GetContactDetailUseCase` — incluye leads y properties asociados
- `DeleteContactUseCase`

## Endpoints

[[API-crm]]:
- `GET /contacts`, `GET /contacts/:id`, `POST /contacts`, `DELETE /contacts`

## Frontend

- `/contactos` (lista searchable)
- `/contactos/[id]` (detalle con leads + properties)
- Componente reutilizable: `ContactSelector.tsx` (dropdown con búsqueda)

## Relacionados

- [[Dominio-Leads]] — un contact puede tener N leads
- [[Dominio-Propiedades]] — `properties.contact_id` apunta al propietario
- [[Dominio-Usuarios-Org]] — `agent_id` apunta a un user
