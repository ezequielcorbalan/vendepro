# 📋 Dominio: Actividades

Log de acciones realizadas por agentes (llamadas, WhatsApps, visitas, seguimientos, etc.). Append-only.

## Tipos de actividad

11 tipos en `lib/crm-config.ts → ACTIVITY_TYPES`:

- `llamada`, `whatsapp`, `reunion`
- `visita_captacion`, `visita_comprador`, `tasacion`
- `presentacion`, `seguimiento`, `documentacion`
- `admin`, `cierre`

## Entidad

**`Activity`** (`domain/entities/activity.ts`):
- `id`, `org_id`, `agent_id`
- `activity_type`, `description`, `result`, `duration_minutes`
- Links opcionales: `lead_id`, `contact_id`, `property_id`, `appraisal_id`
- `created_at`

## Tabla D1

`activities` — Índices: `(org_id)`, `agent_id`, `lead_id`.

## Use cases

Mayormente append-only:
- `CreateActivity` (inline en queries de routes, no hay use case formal grande)
- `GetActivityStats` (analytics)

## Endpoints

[[API-crm]]:
- `GET /activities` (filters: `agent_id`, `lead_id`, `contact_id`, `property_id`)

(No hay POST `/activities` directo — las activities se crean dentro de otros use cases, ej. al completar un evento del calendario.)

## Frontend

- `/actividades` — timeline filtrable

## Métricas derivadas

Las actividades alimentan:
- Objetivos por agente (ver [[Dominio-Objetivos]])
- Performance reports (ver [[API-analytics]])
- Dashboard `mi-performance`

## Relacionados

- [[Dominio-Leads]] · [[Dominio-Contactos]] · [[Dominio-Propiedades]] · [[Dominio-Tasaciones]]
- [[Dominio-Calendario]] (algunos eventos completados generan actividades)
- [[Dominio-Objetivos]] (las metas se miden contra actividades)
