# State Machine unificado de Leads y Propiedades

**Fecha:** 2026-05-17
**Estado:** diseño aprobado, pendiente de plan de implementación
**Autor:** brainstorming session con Marcela Genta Operaciones Inmobiliarias

## Contexto

El CRM tiene dos pipelines paralelos (Lead y Property) que hoy operan con state machines incompletas y desincronizadas:

- `Lead.stage`: 9 estados (`nuevo → … → captado | perdido`) con transiciones validadas en `lead-stage.ts`.
- `Property.commercial_stage`: 6 estados (`captada → … → vendida | vencida`) en `property-stage.ts`, además de una dimensión separada `status` (`active / sold / suspended / archived / inactive`) en `property-rules.ts`.

Problemas detectados:

1. No existe un estado intermedio para representar “propiedad cargada a un lead que aún no se captó”.
2. El concepto “lead no viable porque la propiedad no es apta para vender” no tiene estado propio.
3. No existe el concepto “lead exitoso” (cuando la propiedad captada efectivamente se vende).
4. Property no contempla “perdida” (intentamos vender y no pudimos) ni “invalida”.
5. Los cambios de estado entre lead y property no se sincronizan automáticamente.
6. La doble dimensión `commercial_stage` + `status` introduce inconsistencias y superficie de error.

## Objetivos

- Unificar el modelo de estados de la propiedad en un único `commercial_stage` (eliminar `status` como dimensión separada).
- Agregar estados que reflejen la realidad operativa: `propuesta`, `invalida`, `perdida` (en Property) y `invalido`, `finalizado` (en Lead).
- Sincronizar automáticamente los pipelines de Lead y Property donde corresponde.
- Implementar con un patrón State extendiendo los value objects actuales y agregando un módulo declarativo de reglas cruzadas (`sync-policies.ts`) para que el grafo y las reglas de sincronización sean modificables en un solo lugar.
- Mantener `suspendida`, `vencida` y `archivada` (estados existentes) con su semántica actual.

No-objetivos:

- No introducir event bus / event-driven architecture. La sincronización es síncrona y explícita en use cases.
- No eliminar la tabla `property_statuses` ni la columna `status_id` en esta release (queda deprecada, removible en migration futura).
- No agregar feature flag — el grafo nuevo aplica desde el deploy.

## State Machine — Lead

### Estados (10)

| Estado | Tipo | Descripción |
|---|---|---|
| `nuevo` | inicial | Recién creado, sin asignar |
| `asignado` | activo | Asignado a un agente |
| `contactado` | activo | Hubo primer contacto |
| `calificado` | activo | Cumple criterios mínimos |
| `en_tasacion` | activo | En proceso de tasación |
| `presentada` | activo | Tasación presentada al lead |
| `seguimiento` | activo (lateral) | En seguimiento — puede volver a calificado/en_tasacion/presentada/captado |
| `captado` | **final del agente** | Mandato firmado: el agente cumplió su objetivo de captación. El lead queda en este estado salvo que la propiedad se materialice como venta o pérdida (sync). |
| `invalido` | **final terminal** | Lead no viable (propiedad no apta, fake, duplicado, etc.) |
| `finalizado` | **final terminal** | Auto: la propiedad captada se vendió |
| `perdido` | **final terminal** | Manual (pre-captado) o auto (captado + propiedad perdida) |

**Distinción importante:** `captado` es estado final desde la perspectiva operativa del agente (su trabajo terminó), pero **no terminal** del grafo: el lead puede transicionar automáticamente a `finalizado` o `perdido` cuando la propiedad asociada se cierra. Si la propiedad nunca se vende ni se pierde formalmente, el lead permanece en `captado` indefinidamente.

### Transiciones

```
nuevo       → asignado, contactado, invalido, perdido
asignado    → contactado, invalido, perdido
contactado  → calificado, seguimiento, invalido, perdido
calificado  → en_tasacion, seguimiento, invalido, perdido
en_tasacion → presentada, seguimiento, invalido, perdido
presentada  → captado, seguimiento, invalido, perdido
seguimiento → calificado, en_tasacion, presentada, captado, invalido, perdido
captado     → finalizado, perdido    (solo vía sync — no manual)
invalido    → ∅
finalizado  → ∅
perdido     → ∅
```

Las transiciones de **salida** de `captado` (a `finalizado` o `perdido`) son únicamente automáticas vía sync con la property. Las transiciones de **entrada** a `captado` (desde `presentada` o `seguimiento`) siguen siendo manuales como hoy.

## State Machine — Property (commercial_stage)

### Estados (11)

| Estado | Tipo | Descripción |
|---|---|---|
| `propuesta` | inicial | Cargada al sistema, aún no se firmó autorización |
| `captada` | activo | Mandato firmado, comienza comercialización |
| `documentacion` | activo | Reuniendo documentos críticos |
| `publicada` | activo | Visible en portales |
| `reservada` | activo | Oferta aceptada, en cierre |
| `vencida` | activo (reversible) | Mandato expirado (puede renovarse) |
| `suspendida` | pausa reversible | Pausada temporalmente |
| `vendida` | **final** | Auto desde reservada → dispara lead `finalizado` |
| `perdida` | **final** | Manual: intentamos vender y no pudimos → dispara lead `perdido` |
| `invalida` | **final** | Auto (lead → invalido) o manual: propiedad no apta |
| `archivada` | **final** | Administrativo |

### Transiciones

```
propuesta      → captada, invalida
captada        → documentacion, publicada, perdida, invalida, suspendida
documentacion  → publicada, perdida, invalida, suspendida
publicada      → reservada, perdida, vencida, suspendida
reservada      → vendida, publicada, perdida, vencida, suspendida
suspendida     → publicada, reservada, archivada
vencida        → publicada, archivada
vendida        → archivada
perdida        → archivada
invalida       → archivada
archivada      → ∅
```

`suspendida` y `vencida` son los únicos puntos reversibles del grafo (vuelven a `publicada` / `reservada`).

### Aplicación a alquileres

Por ahora alquiler usa el **mismo grafo que venta** (mismos estados, mismas transiciones). Los slugs históricos específicos de alquiler (`captacion`, `alquilada`, `con_interesados`) se unifican con los de venta:

- `captacion` → `captada`
- `alquilada` → `vendida` (semánticamente: "operación cerrada")
- `con_interesados` → `publicada`

A futuro, si se requiere diferenciar el flujo de alquiler, se puede separar el grafo introduciendo `operation_type_id` en la validación de transiciones. Hoy no es necesario.

## Estado inicial

Toda propiedad nace en `propuesta`, independientemente del origen (creada desde lead, desde tasación, o carga directa en módulo Propiedades). El usuario la promueve manualmente a `captada` cuando corresponde, o el sistema la promueve automáticamente cuando su lead asociado pasa a `captado`.

## Sincronización Lead ↔ Property

Cuatro reglas declarativas en `sync-policies.ts`:

| Trigger | Side-effect | Condición |
|---|---|---|
| `lead → captado` | property `propuesta → captada` | Solo si property está en `propuesta` |
| `lead → invalido` | property → `invalida` | Solo si property está en estado no-final |
| `property → vendida` | lead `captado → finalizado` | Solo si lead está en `captado` |
| `property → perdida` | lead `captado → perdido` | Solo si lead está en `captado` |

### Casos borde

- Lead sin property: las reglas lead → property no ejecutan nada.
- Property sin lead (carga directa): las reglas property → lead no ejecutan nada.
- Lead pasa a `perdido` **manualmente** desde pre-captado: la property queda en su estado actual. El agente decide después si la pasa a `invalida`, `perdida`, o la archiva manualmente. No hay sync automático en este caso.
- Cardinalidad: property tiene 0 o 1 lead origen (`property.lead_id`); lead tiene 0 o 1 property asociada.

### Auditoría

Toda transición se loguea en `stage_history` con `triggered_by`:
- `user` — cambio manual desde UI
- `sync` — cambio automático disparado por la contraparte
- `system` — cambios administrativos (ej. expiración de mandato, archivado por housekeeping)

## Arquitectura — Patrón State (enfoque A)

### Estructura de archivos

```
vendepro-backend/packages/core/src/domain/
├── value-objects/
│   ├── lead-stage.ts          # extender: nuevos estados + transitions
│   └── property-stage.ts      # extender: nuevos estados + transitions
├── rules/
│   ├── sync-policies.ts       # NUEVO: tabla declarativa de reglas cruzadas
│   ├── sync-engine.ts         # NUEVO: ejecuta reglas (lead→property, property→lead)
│   └── property-rules.ts      # remover canTransitionPropertyStatus (status deprecado)
└── entities/
    ├── lead.ts                # advanceStage ya existe, usa LeadStage VO
    └── property.ts            # changeCommercialStage usa PropertyStage VO

vendepro-backend/packages/core/src/application/use-cases/
├── leads/
│   └── advance-lead-stage.ts          # extender: invocar SyncEngine
└── properties/
    └── update-property-stage.ts       # extender: invocar SyncEngine
```

### Tabla declarativa de reglas cruzadas

```ts
// sync-policies.ts
export type SyncRule<From, To> = {
  when: From
  thenIfTargetIn: To[]
  setTargetTo: To
}

export const LEAD_TO_PROPERTY_SYNC: SyncRule<LeadStageValue, PropertyStageValue>[] = [
  { when: 'captado',  thenIfTargetIn: ['propuesta'],     setTargetTo: 'captada'  },
  { when: 'invalido', thenIfTargetIn: NON_FINAL_PROPERTY, setTargetTo: 'invalida' },
]

export const PROPERTY_TO_LEAD_SYNC: SyncRule<PropertyStageValue, LeadStageValue>[] = [
  { when: 'vendida', thenIfTargetIn: ['captado'], setTargetTo: 'finalizado' },
  { when: 'perdida', thenIfTargetIn: ['captado'], setTargetTo: 'perdido'    },
]
```

Modificar una regla = una línea en este archivo.

### Use case orquestador (ejemplo)

```ts
async execute(leadId, newStage) {
  const lead = await leadRepo.findById(leadId)
  const oldStage = lead.stage
  lead.advanceStage(newStage)  // valida en LeadStage VO
  await leadRepo.update(lead)
  await stageHistoryRepo.log(lead, oldStage, newStage, 'user')

  if (lead.property_id) {
    const property = await propertyRepo.findById(lead.property_id)
    const synced = SyncEngine.applyLeadToProperty(lead, property)
    if (synced) {
      await propertyRepo.update(synced)
      await stageHistoryRepo.log(synced, property.commercial_stage, synced.commercial_stage, 'sync')
    }
  }
}
```

Ambos use cases comparten patrón: cambio principal → log → sync condicional → log de sync.

### Transacción

Cada cambio de stage se ejecuta en una sola transacción D1 que toca: tabla principal, `stage_history`, tabla contrapartida (si hay sync). Si la transacción falla, ningún cambio se persiste.

## Frontend

Cambios contenidos:

- `crm-config.ts` (`vendepro-frontend/src/lib/`): agregar `propuesta`, `invalida`, `perdida` con label + color al objeto `PROPERTY_STAGES`. Agregar `invalido`, `finalizado` a `LEAD_STAGES`.
- `pipeline/page.tsx`: actualizar `MAIN_STAGES` para incluir `propuesta` al inicio y reflejar el grafo nuevo. `MAIN_STAGES = ['propuesta', 'captada', 'publicada', 'reservada', 'vendida']`.
- `PropertyFilters.tsx`: agregar los nuevos estados a los filtros disponibles.
- 9 archivos del frontend referencian `commercial_stage` — revisar cada uno para soporte de los nuevos valores (no se requiere validación de transición en frontend, eso lo hace el backend).
- No hace falta lógica de state machine en frontend.

### Agrupamiento "Activas" en UI

**No es un commercial_stage en el backend**, es un view filter en el frontend. Una propiedad aparece en la vista "Activas" si `commercial_stage ∈ {captada, documentacion, publicada, reservada}`. Se implementa como:

- Una pestaña/filtro en `/propiedades` o `/propiedades/pipeline` que filtra por este conjunto.
- Constante helper en `crm-config.ts`: `export const ACTIVE_PROPERTY_STAGES = ['captada', 'documentacion', 'publicada', 'reservada']`.
- Otras agrupaciones equivalentes para consistencia: `PROPOSED_PROPERTY_STAGES = ['propuesta']`, `FINAL_PROPERTY_STAGES = ['vendida', 'perdida', 'invalida', 'archivada']`, `PAUSED_PROPERTY_STAGES = ['suspendida', 'vencida']`.

Cuando el lead asociado pasa a `captado` y la property sincroniza de `propuesta` → `captada`, automáticamente la property pasa a aparecer en la vista "Activas" sin lógica adicional en frontend.

## Migración de datos

Una sola migration en `vendepro-backend/migrations_v2/019_state_machine_unification.sql`:

1. INSERT en `commercial_stages` para `propuesta`, `invalida`, `perdida` (operation_type_id de venta y de alquiler — mismos slugs, mismo grafo).
2. UPDATE de slugs legacy de alquiler para unificar con venta: `captacion → captada`, `alquilada → vendida`, `con_interesados → publicada` en `commercial_stages` y en cualquier `property.commercial_stage` que aún use los slugs antiguos.
3. UPDATE properties: las que tienen `lead_id`, cuyo lead **no está** en `captado` ni en estado final post-captado (`finalizado`/`perdido`/`invalido`), y la property está en `captada` sin avance posterior → mover a `propuesta`. Criterio conservador, no toca properties que ya avanzaron a `documentacion`/`publicada`/`reservada`/etc.
4. Leads en `perdido` con historia previa pre-captado se mantienen en `perdido` (no se migran a `invalido` retroactivamente).
5. Tabla `property_statuses` y columna `status_id` quedan deprecadas, no se eliminan. Removidas en migration futura una vez verificado que ningún código las consume.
6. La migration corre automáticamente en deploy vía workflow `migrate.yml`.

## Testing

```
vendepro-backend/packages/core/test/
├── domain/value-objects/
│   ├── lead-stage.test.ts          # matriz completa de transiciones válidas e inválidas
│   └── property-stage.test.ts      # idem
├── domain/rules/
│   ├── sync-policies.test.ts       # cada regla declarativa
│   └── sync-engine.test.ts         # aplicación a casos lead/property concretos
└── application/use-cases/
    ├── advance-lead-stage.test.ts  # incluye sync property
    └── update-property-stage.test.ts # incluye sync lead
```

Casos cubiertos:

- Cada transición válida del grafo (matriz).
- Rechazo de transiciones inválidas con error de dominio.
- Sync cruzado dispara solo cuando se cumplen las condiciones (no dispara si el target está en estado fuera del whitelist).
- Sync no rompe cuando lead no tiene property o viceversa.
- `stage_history` recibe los dos eventos (user + sync) cuando hay sincronización.
- Property creada desde cada origen (lead, tasación, módulo Propiedades) nace en `propuesta`.

## Rollout

1. Merge a `main` con la migration y código.
2. Workflow `migrate.yml` aplica D1 automáticamente al pushear `migrations_v2/**`.
3. Backend deploys vía GH Actions (workers afectados: `crm-api`, `properties-api`).
4. Frontend deploy automático vía Cloudflare Pages al pushear `vendepro-frontend/`.
5. Verificación manual: `/leads`, `/leads/[id]`, `/propiedades`, `/propiedades/pipeline`, `/propiedades/[id]`, creación de leads/propiedades, transición manual, transición sincronizada.

## Riesgos identificados

- `MAIN_STAGES` hardcoded en `pipeline/page.tsx:12` — actualizar manualmente.
- 9 archivos del frontend referencian `commercial_stage` (ver `Grep`) — revisar uno por uno por hardcoded value lists.
- `AdvanceLeadStageUseCase` y `UpdatePropertyStageUseCase` ya existen — extender, no reemplazar, para no perder logging de marketing events ni de stage_history.
- Alquileres tienen slugs históricos distintos (`captacion`, `alquilada`, `con_interesados`) — la migration los unifica con los slugs de venta. Verificar que ningún código frontend/backend hardcodea esos slugs antiguos.
- Tabla `commercial_stages` tiene `operation_type_id` — los nuevos slugs deben insertarse para ambos tipos (venta y alquiler).

## Decisiones registradas durante el brainstorming

- Enfoque elegido: A (value objects + sync engine + sync-policies declarativas). Descartado B (event bus, YAGNI) y C (lookup table en DB, mala UX/debugging).
- Property arranca siempre en `propuesta`, independiente del origen.
- `invalido` accesible manualmente desde cualquier estado pre-captado del lead.
- `perdido` accesible manualmente (pre-captado) y automáticamente (desde property perdida cuando lead está en `captado`).
- `captado` no acepta transiciones manuales — solo sync.
- Status separado (`active/suspended/archived/inactive/sold`) se elimina como dimensión; queda deprecado en DB sin removerse en esta release.
- Nombre del estado nuevo de property: `propuesta` (descartados `pre_captacion`, `tasacion`, `borrador`).
- `suspendida`, `vencida`, `archivada` se mantienen con su semántica actual.
- Auditoría: `stage_history.triggered_by ∈ {user, sync, system}`.
- Aplica a venta y alquiler con el mismo grafo (alquiler unifica slugs legacy con los de venta).
