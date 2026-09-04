# 🎯 Dominio: Leads

El **lead** es el prospecto que entra al pipeline comercial. Es la entidad más importante del CRM.

## Pipeline

```
nuevo → asignado → contactado → calificado → en_tasacion → presentada → seguimiento → captado
                                                                                      ↘ perdido
```

(9 stages, definidos en `domain/value-objects/lead-stage.ts` con transiciones validadas.)

> La etapa `perdido` se muestra en la UI del pipeline vendedor como
> **"No captado"**, y `finalizado` como **"Vendido"**. Las claves no cambian.
> Un no captado sale del pipeline pero queda con recontacto agendado a los 30 y
> 120 días. Detalle completo en [[Estados]] §1 y §1.1.

## Entidad

- **`Lead`** (`packages/core/src/domain/entities/lead.ts`)

Campos principales:
- Identificación: `id`, `org_id`, `full_name`, `phone`, `email`
- Origen: `source` (otro|zonaprop|argenprop|mercadolibre|instagram|facebook|google|referido|cartel|telefono|manual), `source_detail`
- Interés: `property_address`, `neighborhood`, `property_type`, `operation` (venta|alquiler|alquiler_temporal|tasacion|otro)
- Estado: `stage`, `assigned_to`, `contact_id`
- Negocio: `notes`, `estimated_value`, `budget`, `timing`, `personas_trabajo`, `mascotas`
- Workflow: `next_step`, `next_step_date`, `lost_reason`, `first_contact_at`
- Timestamps: `created_at`, `updated_at`

Métodos: `advanceStage(newStage)`, `update(data)`, `getUrgency()`, `getChecklistScore()`, `getChecklist()`, `needsFollowupEvent()`.

## Reglas de negocio (`domain/rules/lead-rules.ts`)

- `getLeadUrgency(lead)` → ok | warning | danger | lost
  - Lead nuevo sin contactar en **24h** → `danger`
  - Sin updates en **7 días** → `danger`
  - Sin updates en **3 días** → `warning`
- `getLeadChecklist(lead)` → estado de {contacto, necesidad, operacion, presupuesto, zona, proxima_accion}
- `getLeadChecklistScore(lead)` → 0-100
- `computeLeadFunnel(stageBreakdown, totalLeads)` → estadísticas para dashboard
- `computeConversionRate(...)` → % captados

## Tabla D1

`leads` (ver [[DB-overview]]):
- 24 columnas
- Índices: `(org_id, stage)`, `assigned_to`, `created_at`
- FKs: `assigned_to → users(id)`, `contact_id → contacts(id)`
- M:N con tags vía `lead_tags`

## Use cases

En `packages/core/src/application/use-cases/leads/`:
- `CreateLeadUseCase` — sin contacto
- `CreateLeadWithContactUseCase` — crea Lead + Contact en una transacción (usado por POST /leads y por captura pública)
- `GetLeadsUseCase` — filtros stage / agent / search
- `UpdateLeadUseCase`
- `DeleteLeadUseCase`
- `AdvanceLeadStageUseCase` — valida transición + loguea en `stage_history` + dispara marketing event

## Endpoints

[[API-crm]]:
- `GET/POST/PUT/DELETE /leads`
- `POST /leads/stage`
- `GET /stage-history?entity_type=lead&entity_id=...`

Captura pública: `POST /public/leads` en [[API-public]] (con `X-API-Key`).

## Frontend

- `/leads` (kanban + tabla, drag-drop entre stages)
- `/leads/[id]` (detalle, editar, historial, tags, next step)
- Componentes IA: `AIChatPanel`, `AIFloatingButton` (asociados a leads)

## Relacionados

- [[Dominio-Contactos]] (cada lead crea/usa un contact)
- [[Dominio-Tags]]
- [[Dominio-Actividades]] (actividades pueden linkear lead_id)
- [[Dominio-Calendario]] (eventos pueden linkear lead_id)
- [[Dominio-Tasaciones]] (tasaciones nacen de un lead)
- [[Dominio-Marketing]] (cada cambio de stage puede disparar evento)
