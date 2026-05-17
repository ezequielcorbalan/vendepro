# 🎯 Dominio: Objetivos

KPIs por agente y período. Configurables por admin/supervisor, consultables por el agente.

## Entidad

**`Objective`** (`domain/entities/objective.ts`):
- `id`, `org_id`, `agent_id`
- `metric`, `target`
- `period_type` (mensual | trimestral | anual)
- `period_start`, `period_end`
- Timestamps

## Métricas disponibles

16 métricas en `lib/crm-config.ts → OBJECTIVE_METRICS`:

- Actividades: `llamadas`, `reuniones`, `visitas`, `seguimientos`, `whatsapps`, `presentaciones`
- Producción: `tasaciones`, `captaciones`, `publicaciones`, `reservas`, `cierres`
- Económicas: `facturacion`, etc.

## Templates

3 plantillas predefinidas en `lib/crm-config.ts → OBJECTIVE_TEMPLATES`:

- `keller` — Keller Williams style
- `magnin` — Magnin style
- `agenda` — agenda básica

Helpers en config: `scaleMetrics(template, factor)`, `getObjectiveSemaforo(progress)`, `getPeriodProgressPct(period_start, period_end, now)`.

## Tabla D1

`agent_objectives` — Índices: `(org_id, period_end)`.

## Use cases

- `SetObjectivesUseCase` (admin/supervisor)
- Listado: query inline en route
- Métricas reales del agente para comparar: ver [[Dominio-Actividades]] y reports

## Endpoints

[[API-admin]]:
- `GET /objectives` (`?agent_id, ?period_type`)
- `POST /objectives`
- `DELETE /objectives` (`?id`)

## Frontend

- `/admin/objetivos` — admin/supervisor configura
- `/configuracion/objetivos` — vista de mi org
- `/perfil/objetivos` — agente ve sus propios objetivos
- Sema­foro de salud: verde / amarillo / rojo según `OBJECTIVE_PROGRESS`

## Reglas

- Solo `owner | admin | supervisor` pueden setear objetivos (ver `role-rules.ts`)
- Las métricas se calculan **on the fly** consultando actividades del período (no se denormalizan)

## Relacionados

- [[Dominio-Usuarios-Org]]
- [[Dominio-Actividades]]
