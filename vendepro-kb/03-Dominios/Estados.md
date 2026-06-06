# 🔄 Estados y máquinas de estado

Documento unificado de **state machines** del CRM: lead, property, reservation. Incluye transiciones manuales, sincronización cruzada (`sync-engine`), terminales y endpoints que las disparan.

> Fuente de verdad en código:
> - `vendepro-backend/packages/core/src/domain/value-objects/lead-stage.ts`
> - `vendepro-backend/packages/core/src/domain/value-objects/property-stage.ts`
> - `vendepro-backend/packages/core/src/domain/rules/sync-engine.ts`
> - `vendepro-backend/packages/core/src/domain/rules/sync-policies.ts`
> - `vendepro-backend/packages/core/src/domain/rules/reservation-rules.ts`
> - Migración `vendepro-backend/migrations_v2/027_state_machine_unification.sql`

---

## 1. Lead — 11 stages

```
nuevo ─► asignado ─► contactado ─► calificado ─► en_tasacion ─► presentada ─► captado
                                       │             │              │            │
                                       └─────────────┴──────────────┘            ▼
                                              seguimiento ◄────┘            finalizado / perdido
                                                                                  ▲
                                                                                  │
                                       (sync desde property: vendida → finalizado,
                                                            perdida → perdido)
```

### Estados

| Stage | Tipo | Notas |
|---|---|---|
| `nuevo` | inicial | Lead recién creado |
| `asignado` | activo | Asignado a un agente |
| `contactado` | activo | Primer contacto realizado |
| `calificado` | activo | Cumple criterios mínimos |
| `en_tasacion` | activo | Tasación en curso |
| `presentada` | activo | Tasación presentada (dispara seguimiento automático +7d) |
| `seguimiento` | activo | En seguimiento, puede volver atrás |
| `captado` | semi-terminal | Captación completa. **Cierra al agente**, sigue abierto a sync |
| `invalido` | terminal | Manual desde casi cualquier estado |
| `finalizado` | terminal | Solo por sync desde `property.vendida` |
| `perdido` | terminal | Manual o por sync desde `property.perdida` |

### Transiciones manuales (`MANUAL_TRANSITIONS`)

| Desde | A |
|---|---|
| `nuevo` | `asignado`, `contactado`, `invalido`, `perdido` |
| `asignado` | `contactado`, `invalido`, `perdido` |
| `contactado` | `calificado`, `seguimiento`, `invalido`, `perdido` |
| `calificado` | `en_tasacion`, `seguimiento`, `invalido`, `perdido` |
| `en_tasacion` | `presentada`, `seguimiento`, `invalido`, `perdido` |
| `presentada` | `captado`, `seguimiento`, `invalido`, `perdido` |
| `seguimiento` | `calificado`, `en_tasacion`, `presentada`, `captado`, `invalido`, `perdido` |
| `captado` | — *(solo sync puede sacarlo)* |
| `invalido`, `finalizado`, `perdido` | — *(terminal)* |

### Transiciones por sync (`SYNC_TRANSITIONS`)

| Desde | A | Disparado por |
|---|---|---|
| `captado` | `finalizado` | `property.vendida` |
| `captado` | `perdido` | `property.perdida` |

`LeadStage.canTransitionTo(next, { source: 'sync' })` admite **manual + sync**.

---

## 2. Property — 11 stages

```
propuesta ─► captada ─► documentacion ─► publicada ─► reservada ─► vendida
              │             │              │             │            │
              │             │              ▼             ▼            ▼
              │             │           suspendida   suspendida    archivada
              │             │              │             │
              │             │              ▼             ▼
              │             │           publicada    publicada
              │             │                            │
              │             │                            ▼
              │             └────────────► vencida ─► archivada
              ▼
           perdida / invalida ─► archivada
```

### Estados

| Stage | Tipo | Notas |
|---|---|---|
| `propuesta` | inicial | Propiedad propuesta por un lead, aún no captada |
| `captada` | activo | Mandato firmado |
| `documentacion` | activo | Recopilando documentos críticos |
| `publicada` | activo | Listada en portales |
| `reservada` | activo | Oferta aceptada |
| `suspendida` | pausa | Pausada temporalmente |
| `vencida` | pausa | Mandato vencido |
| `vendida` | terminal | Operación cerrada exitosa |
| `perdida` | terminal | No se concretó |
| `invalida` | terminal | Datos inválidos / duplicado |
| `archivada` | terminal final | Solo destino, no se sale |

### Transiciones (`VALID_TRANSITIONS`)

| Desde | A |
|---|---|
| `propuesta` | `captada`, `invalida` |
| `captada` | `documentacion`, `publicada`, `perdida`, `invalida`, `suspendida` |
| `documentacion` | `publicada`, `perdida`, `invalida`, `suspendida` |
| `publicada` | `reservada`, `perdida`, `vencida`, `suspendida` |
| `reservada` | `vendida`, `publicada`, `perdida`, `vencida`, `suspendida` |
| `suspendida` | `publicada`, `reservada`, `archivada` |
| `vencida` | `publicada`, `archivada` |
| `vendida` | `archivada` |
| `perdida` | `archivada` |
| `invalida` | `archivada` |
| `archivada` | — |

> Property no distingue source (manual/sync): `transitionTo` valida igual para ambos. El origen se registra en `stage_history.triggered_by`.

---

## 3. SyncEngine — sincronización cruzada

Reglas en `sync-policies.ts`. Cuando un lado cambia, el otro **puede** cambiar si su estado actual está en `thenIfTargetIn`.

### Lead → Property (`LEAD_TO_PROPERTY_SYNC`)

| Lead pasa a | Property cambia si está en | Property queda en |
|---|---|---|
| `captado` | `propuesta` | `captada` |
| `invalido` | cualquier no-terminal | `invalida` |

> Estados no-terminales de property: `propuesta, captada, documentacion, publicada, reservada, suspendida, vencida`.

### Property → Lead (`PROPERTY_TO_LEAD_SYNC`)

| Property pasa a | Lead cambia si está en | Lead queda en |
|---|---|---|
| `vendida` | `captado` | `finalizado` |
| `perdida` | `captado` | `perdido` |

**Importante:**
- Sync es **unidireccional por evento** — no hace cascada infinita.
- Si no hay regla aplicable, el otro lado **no se toca**.
- El log queda en `stage_history` con `triggered_by='sync'` y nota `Sync desde lead X (stage)` / `Sync desde property X (stage)`.

---

## 4. stage_history

Tabla append-only que registra cada transición.

```sql
id, org_id, entity_type ('lead' | 'property' | 'reservation' | 'appraisal'),
entity_id, from_stage, to_stage, changed_by, notes, triggered_by, created_at
```

- `triggered_by`: `'user'` | `'sync'` | `'system'` *(default 'user', columna añadida en migración 027)*
- Lectura: `GET /stage-history?entity_type=<t>&entity_id=<id>` ([[API-crm]])

---

## 5. Reservation — pipeline transaccional

Definido en `domain/rules/reservation-rules.ts`. **No** sincroniza automáticamente con property (modelo laxo, ver [[Dominio-Reservas]]).

```
reservada ─► boleto ─► escritura ─► entregada
         ↘ cancelada
         ↘ rechazada
```

Endpoint: `PUT /reservations/stage` ([[API-transactions]]). Cada cambio puede disparar evento de marketing (`reservation_reservada`, `reservation_escriturada`, etc.).

---

## 6. Appraisal status

Estado **operativo simple** (no máquina de transiciones complejas):

```
draft → generated → sent
```

Definido como columna `status` en tabla `appraisals`. Sin sync con leads/propiedades.

---

## 7. Endpoints que disparan transiciones

| Endpoint | Use case | Sync que dispara |
|---|---|---|
| `POST /leads/stage` | `AdvanceLeadStageUseCase` | Lead → Property |
| `PUT /properties/:id/stage` | `UpdatePropertyStageUseCase` | Property → Lead |
| `PUT /reservations/stage` | `AdvanceReservationStageUseCase` | — (laxo) |
| `GET /stage-history` | — | solo lectura |

Body de los endpoints:
```json
// POST /leads/stage
{ "id": "<leadId>", "stage": "captado", "notes": "..." }

// PUT /properties/:id/stage
{ "commercial_stage": "publicada", "notes": "..." }
// o
{ "commercial_stage_id": 3 }
```

---

## 8. Side-effects al cambiar de stage

| Trigger | Side-effect |
|---|---|
| Lead → `presentada` | Crea evento calendario `seguimiento` +7d (auto-followup) |
| Lead → cualquier stage con mapping | Dispara evento Meta CAPI (`SendMetaConversionEventUseCase`) |
| Reservation → stage con mapping | Dispara evento Meta CAPI |
| Cualquier transición | Log en `stage_history` |

Mappings configurables en `stage_event_mappings` (admin). Ver [[Dominio-Marketing]].

---

## 9. Estados terminales

| Entidad | Terminales |
|---|---|
| Lead | `invalido`, `finalizado`, `perdido` |
| Property | `vendida`, `perdida`, `invalida`, `archivada` |
| Reservation | `entregada`, `cancelada`, `rechazada` |

`captado` en lead **no** es terminal a nivel sistema (puede sincronizar a `finalizado` / `perdido`); sí es terminal para el agente (`isAgentFinal()`).

---

## 10. Tests de referencia

- `vendepro-backend/packages/core/tests/domain/lead-stage.test.ts`
- `vendepro-backend/packages/core/tests/domain/property-stage.test.ts`
- `vendepro-backend/packages/core/tests/domain/rules/sync-engine.test.ts`
- `vendepro-backend/packages/core/tests/domain/rules/sync-policies.test.ts`
- `vendepro-backend/packages/core/tests/use-cases/leads/advance-lead-stage-sync.test.ts`
- `vendepro-backend/packages/core/tests/use-cases/properties/update-property-stage.test.ts`
- **Smoke**: `vendepro-backend/packages/core/tests/smoke/state-machine-flow.smoke.test.ts`

---

## 11. Plan de smoke test sobre APIs en vivo

Escenarios mínimos a correr contra APIs deployadas (o `wrangler dev` local):

### Bloque A — Lead manual
1. `POST /leads` → crear lead en `nuevo`.
2. `POST /leads/stage` → `nuevo → asignado` *(esperado 200)*.
3. `POST /leads/stage` → `asignado → calificado` *(esperado 400 — transición inválida manual)*.
4. `POST /leads/stage` → `asignado → contactado → calificado → en_tasacion → presentada` *(verifica auto-followup en calendario)*.

### Bloque B — Property manual
1. `POST /properties` → crear con `commercial_stage='captada'`.
2. `PUT /properties/:id/stage` → `captada → publicada` *(esperado 200)*.
3. `PUT /properties/:id/stage` → `publicada → vendida` *(esperado 400 — saltea reservada)*.
4. `PUT /properties/:id/stage` → `publicada → reservada → vendida` *(esperado 200)*.

### Bloque C — Sync Lead → Property
1. Crear lead, crear property con `lead_id=<lead>` y `commercial_stage='propuesta'`.
2. Avanzar lead hasta `captado`.
3. Verificar:
   - `properties.commercial_stage === 'captada'`
   - `stage_history` tiene fila con `entity_type='property'`, `triggered_by='sync'`, notas `Sync desde lead <id> (captado)`.

### Bloque D — Sync Property → Lead
1. Lead en `captado` + property `captada` con `lead_id=<lead>`.
2. `PUT /properties/:id/stage` → `publicada → reservada → vendida`.
3. Verificar:
   - `leads.stage === 'finalizado'`
   - `stage_history` tiene fila con `entity_type='lead'`, `triggered_by='sync'`.

### Bloque E — Terminales y no-sync
1. Lead en `captado` + property `documentacion` (no captada aún) → llevar property a `vendida` — el lead **no** debe sincronizar (regla solo aplica si lead está en `captado` y property pasa a `vendida` desde un flujo válido, pero `documentacion → vendida` ni siquiera es transición válida — esperar 400).
2. Lead `invalido` con property `publicada` → al pasar lead a `invalido`, property → `invalida`.

### Bloque F — stage_history
1. Tras los bloques anteriores, `GET /stage-history?entity_type=lead&entity_id=<id>` debe devolver historial ordenado con `triggered_by` correcto en cada fila.

### Hallazgos esperados a confirmar
- Que el endpoint legacy `PUT /properties/:id/stage` con `commercial_stage_id` (vs `commercial_stage` slug) también loggee historial — **actualmente NO**, va por `UpdatePropertyUseCase` plano (ver `properties.ts:100-105`). Punto a evaluar.
- Que el sync de lead `invalido` → property funcione en producción tras migración 027 (estado nuevo).

---

## 12. Caveats y bugs conocidos

### Properties nuevas arrancan con `commercial_stage = NULL`

`CreatePropertyUseCase` setea `commercial_stage: null`. El `UpdatePropertyStageUseCase` lee `currentStage = property.commercial_stage ?? 'propuesta'` y permite transicionar a `captada/publicada/etc.` desde ahí. **Pero la fila en DB queda en NULL** hasta que se cambie de stage.

Esto importa para sync: `SyncEngine.applyLeadToProperty` retorna `null` si la property tiene stage `null` — la regla `lead.captado → propuesta → captada` **no dispara** sobre properties recién creadas. Para que sincronice hay que persistir `propuesta` explícitamente vía `PUT /properties/:id` (raw update), porque `PUT /properties/:id/stage` rechaza `propuesta → propuesta`.

### Bug fixed (2026-06): `Property.lead_id` no exponía getter

Hasta junio 2026 el use case `UpdatePropertyStageUseCase` leía `(property as any).lead_id`. El entity `Property` guarda lead_id en `props` privado y no tenía getter público, así que **el sync property→lead nunca disparaba en producción**. Los tests unitarios usaban fake plain objects que sí tenían lead_id en root, ocultando el bug.

Lo encontró el smoke E2E (`packages/smoke-prod` blocks D1/D2). Fix: getter `Property.lead_id` + regression test con entity real.

### Endpoint `GET /leads/:id` no existe

Solo hay `GET /leads` (lista filtrable). Para obtener el stage actual de un lead específico, leer la fila más reciente de `stage_history` (es append-only y ordenada DESC por `changed_at`).

---

## Relacionados

- [[Dominio-Leads]]
- [[Dominio-Propiedades]]
- [[Dominio-Reservas]]
- [[Dominio-Marketing]]
- [[API-crm]] · [[API-properties]] · [[API-transactions]]
