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
| `invalido` | terminal | Manual desde casi cualquier estado. **Descarte definitivo** — ver §1.1 |
| `finalizado` | terminal | Solo por sync desde `property.vendida` |
| `perdido` | terminal | Manual o por sync desde `property.perdida` |

> ⚠️ **Clave ≠ label en el pipeline vendedor.** Las claves de arriba son las que
> viven en `leads.stage`, `stage_history` y las políticas de sync, y no cambian.
> La UI muestra otros nombres porque los originales confundían:
>
> | Clave | Label en la UI | Por qué |
> |---|---|---|
> | `perdido` | **No captado** | El caso real es "tasé y no capté". No es basura: se recontacta (ver §1.1) |
> | `finalizado` | **Vendido** | No es un cierre manual, lo pone el sync cuando la propiedad captada se vende. "Finalizado" se leía como un hermano de "Perdido" |
>
> El mapa de labels vive en `vendepro-frontend/src/lib/crm-config.ts` →
> `LEAD_STAGES`. En el pipeline **comprador**, `perdido` sigue siendo "Perdido":
> ahí sí es un lead perdido y no hay captación de por medio.

### 1.1 Los dos cierres negativos: `perdido` vs `invalido`

Los dos sacan al lead del pipeline, pero **no son lo mismo** y la diferencia es
operativa, no cosmética:

| | `perdido` — "No captado" | `invalido` — "Inválido" |
|---|---|---|
| Qué es | Se trabajó y no se captó: tasé y eligió otra inmobiliaria, no acordamos precio, decidió no vender | Un lead al que no se le va a dar seguimiento: dato falso o duplicado, propiedad no apta, o simplemente no vale el tiempo |
| Recontacto | **Sí** — 30 y 120 días | **No**, nunca |
| Automatización | Dispara `recontacto_no_captado` | Ninguna. El trigger es `to_stage = perdido`, así que `invalido` no la activa |
| Sync a property | **No toca la propiedad vinculada** (`LEAD_TO_PROPERTY_SYNC` no tiene regla para `perdido`) | Pasa la propiedad a `invalida` si no está en un estado final |

Un lead que pasa a `perdido` (= "No captado") **sale del pipeline pero no se
descarta**: el propietario sigue queriendo vender y en unos meses puede volver
a estar disponible.

- **Cuándo se retoma lo elige el agente** al cerrarlo, en el modal
  `MarkNotCapturedModal` (motivo + "en 1 mes / en 4 meses / otra fecha / no
  recontactar"). La fecha va a `leads.next_step_date` con
  `next_step = 'Recontactar (no captado)'` y se ve en la card.
- **El recordatorio lo agenda la automatización** `recontacto_no_captado`
  (migración `050_recontacto_no_captado.sql`): trigger `lead.stage_changed`
  con `to_stage = perdido`, condición `lead.pipeline ≠ comprador`, dos acciones
  `create_calendar_event` a `due_in_days` 30 y 120. `dedupe_scope: once`. Activa
  por defecto en las orgs existentes; se apaga desde Configuración →
  Automatizaciones.
- En la lista de Leads los cerrados (`perdido`, `invalido`, `finalizado`) **no
  se muestran**: hay un toggle "Cerrados (N)". El kanban ya los excluía.

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

### Unitarios (`@vendepro/core` + `@vendepro/infrastructure`, corren en `turbo test`)

- `packages/core/tests/domain/lead-stage.test.ts`
- `packages/core/tests/domain/property-stage.test.ts`
- `packages/core/tests/domain/rules/sync-engine.test.ts`
- `packages/core/tests/domain/rules/sync-policies.test.ts`
- `packages/core/tests/use-cases/leads/advance-lead-stage-sync.test.ts`
- `packages/core/tests/use-cases/properties/update-property-stage.test.ts` *(incluye regression con `Property.create()` real — ver §12)*
- `packages/core/tests/use-cases/properties/create-property.test.ts` *(verifica default `propuesta`)*
- `packages/infrastructure/tests/repositories/d1-stage-history-repository.test.ts` *(incluye regression del tiebreaker rowid — ver §12)*
- Smoke in-memory (legacy, mantenido para validar flujos sin red): `packages/core/tests/smoke/state-machine-flow.smoke.test.ts`

### Smoke contra producción (`@vendepro/smoke-prod`, NO corre en `turbo test`)

`packages/smoke-prod/tests/state-machine.smoke.test.ts` — ver §13.

---

## 11. Plan de smoke test sobre APIs en vivo

> Los bloques de abajo son la especificación funcional. La **implementación viva** está en §13 (`packages/smoke-prod/`) y corre automáticamente en CI tras cada deploy (§14). Esta sección queda como referencia textual de qué cubre cada bloque.

Escenarios contra APIs deployadas (o `wrangler dev` local):

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

### Hallazgos confirmados (2026-06) y resueltos en `0f4048e`

Todos surgieron al implementar el smoke en producción. Ver §12 para el bug history detallado.

- ✓ `PUT /properties/:id/stage` con `commercial_stage_id` no loggeaba historial ni sincronizaba — **fixed**: ahora resuelve a slug y pasa por `UpdatePropertyStageUseCase`.
- ✓ Sync property→lead nunca disparaba en prod (`Property.lead_id` sin getter) — **fixed**.
- ✓ Properties nuevas quedaban en `commercial_stage=NULL`, lo que apagaba el sync lead→property — **fixed**: default a `propuesta`.
- ✓ `stage_history` lectura inconsistente bajo escritura concurrente (precisión de segundo + sin tiebreaker) — **fixed**: `ORDER BY changed_at DESC, rowid DESC`.

---

## 12. Caveats y bug history

### Endpoint `GET /leads/:id` no existe

Solo hay `GET /leads` (lista filtrable). Para obtener el stage actual de un lead específico, leer la fila más reciente de `stage_history` (append-only, ordenada `DESC by changed_at, rowid` — ver bug fix más abajo). El smoke usa `expectLeadStage()` (§13) que poll-ea esta query.

### Bug fixed `0f4048e` (2026-06): `stage_history` sin tiebreaker

`changed_at` se persiste con `datetime('now')` — precisión de **segundo**. Transiciones rápidas pueden caer en el mismo segundo, y `ORDER BY changed_at DESC` no desempata: SQLite devolvía las filas en orden indefinido. El smoke en GitHub Actions (red más rápida que local) lo expuso: `history[0]` retornaba la PRIMERA transición de la cadena en vez de la última.

Fix: `ORDER BY changed_at DESC, rowid DESC` en `D1StageHistoryRepository.findByEntity`. `rowid` es el contador implícito de SQLite y rompe empates por orden de inserción exacto.

Regression test: 5 transiciones consecutivas sin sleep en `d1-stage-history-repository.test.ts`.

### Bug fixed `4bf5ee4` (2026-06): `Property.lead_id` no exponía getter

`UpdatePropertyStageUseCase` leía `(property as any).lead_id`. El entity `Property` guardaba lead_id en `props` privado sin getter público, así que **el sync property→lead nunca disparaba en producción**. Los tests unitarios usaban fake plain objects que sí tenían lead_id en root, ocultando el bug — el smoke E2E (blocks D1/D2) lo encontró.

Fix: getter `Property.lead_id` + regression test con `Property.create()` real.

### Bug fixed `4bf5ee4` (2026-06): properties nuevas arrancaban en NULL

`CreatePropertyUseCase` seteaba `commercial_stage: null`. `SyncEngine.applyLeadToProperty` retorna `null` cuando el property stage es null, así que la regla `lead.captado → property.propuesta → property.captada` **nunca disparaba sobre properties nuevas**.

Fix: default a `'propuesta'` en `CreatePropertyUseCase`. Caveat residual: properties creadas ANTES del fix siguen con `null` hasta que se las mueva manualmente — la migración 027 hizo backfill parcial pero no exhaustivo.

### Bug fixed `4bf5ee4` (2026-06): `PUT /properties/:id/stage` con `commercial_stage_id` salteaba todo

El handler tenía dos paths: con `commercial_stage` (slug) pasaba por `UpdatePropertyStageUseCase` (state machine + history + sync); con `commercial_stage_id` (numérico) iba por `UpdatePropertyUseCase` plano y no validaba transición, no loggeaba, no sincronizaba.

`PropertyFilters.tsx` en el frontend manda solo `commercial_stage_id` (override desde dropdown), así que cualquier override de admin era un agujero en el state machine.

Fix: el handler resuelve el ID a slug vía `PropertyRepository.findStageSlugById()` y ambos paths usan el mismo use case. El frontend conserva su catch silencioso, así que un override inválido revierte el dropdown sin error visible (UX mejorable, no bloqueante).

---

## 13. Smoke E2E contra producción

Paquete: `vendepro-backend/packages/smoke-prod/` (workspace npm separado, NO entra en `turbo test`).

### Cómo correrlo

```bash
cd vendepro-backend
SMOKE_EMAIL=smoke@vendepro.com.ar SMOKE_PASSWORD=... npm run smoke:prod
```

Variables opcionales: `SMOKE_BASE_AUTH`, `SMOKE_BASE_CRM`, `SMOKE_BASE_PROPS` para apuntar a otro entorno (defaults a `*.api.vendepro.com.ar`).

### Estructura

```
packages/smoke-prod/
├── tests/
│   ├── api-client.ts            # fetch helper + tracker de entidades + cleanup
│   └── state-machine.smoke.test.ts
├── vitest.config.ts             # JUnit reporter, retry 1, fileParallelism:false
├── tsconfig.json
└── package.json
```

### 31 tests organizados en bloques

| Bloque | Tests | Cubre |
|---|---|---|
| A — Lead manual | 4 | Transiciones válidas/inválidas + auto-followup en `presentada` |
| B — Property manual | 3 | Transiciones válidas/inválidas (salteo de `reservada` rechazado) |
| C — Sync Lead → Property | 2 | `captado` y `invalido` sincronizan property |
| D — Sync Property → Lead | 2 | `vendida` y `perdida` sincronizan lead |
| E — Terminales negativos | 6 | `presentada→perdido`, `seguimiento→perdido`, `captado` sync-only, terminales absorbentes |
| Matriz lead generada | 8 | Casos auto-generados desde `LEAD_STAGES` × `MANUAL_TRANSITIONS` |
| Matriz property generada | 6 | Casos auto-generados desde `PROPERTY_STAGES` × `VALID_TRANSITIONS` |

Las matrices generadas se autoactualizan: si el dominio agrega un stage nuevo, los tests cubren las combinaciones automáticamente.

### Cleanup garantizado

Cada entidad creada (lead, property, contact, calendar event) se registra en `created.*` en `api-client.ts`. El hook `afterAll()` borra todo en orden FK-safe: events → properties → leads → contacts. Aplica pase o falle el test.

### Helpers tolerantes a lag de D1 (importante)

Cloudflare D1 tiene replicación eventually-consistent entre el primary (writes) y la réplica de lectura. En GitHub Actions, escribir y leer inmediatamente puede mostrar la versión vieja por hasta ~2s.

**No leer directamente; usar siempre los helpers**:

```typescript
// MAL — race condition con D1:
const stage = await getLeadStage(id)
expect(stage).toBe('perdido')

// BIEN — poll hasta ver el valor esperado o expirar (default 8s):
expect(await expectLeadStage(id, 'perdido')).toBe('perdido')
expect(await expectPropertyStage(id, 'captada')).toBe('captada')
```

Si el valor nunca aparece, el helper retorna el último valor leído y el assert falla con el diff real.

### Login

`api-client.ts` hace `POST {SMOKE_BASE_AUTH}/login` con `{email, password}` en `beforeAll()`. El JWT queda en una variable de módulo y se inyecta como `Authorization: Bearer` en todas las requests.

Usuario actual: `smoke@vendepro.com.ar` (rol `admin`, org `org_830ca07d3511f8ed06c4bff226fee4c9`). Las credenciales viven en GitHub Secrets (`SMOKE_EMAIL`, `SMOKE_PASSWORD`); no commitear.

---

## 14. CI integration con rollback automático

Ver `.github/workflows/_deploy-api.yml`. Cada deploy de API (api-crm, api-properties, etc.) corre la cadena:

```
test  ──►  deploy  ──►  smoke  ──►  rollback (solo si smoke ✗)
```

### Jobs

1. **test**: `npx turbo run test --concurrency=1` *(serializado para evitar flake de miniflare con D1 paralelo)*
2. **deploy**: `npx wrangler deploy` desde `packages/${api_name}/`
3. **smoke**: `npm run smoke:prod` desde `vendepro-backend/`. Sube `smoke-results.xml` como artifact (JUnit), visible test-by-test en la UI del run.
4. **rollback**: `npx wrangler rollback --message "Auto-rollback: state-machine smoke failed for <sha>"`. Se ejecuta SOLO si `needs.smoke.result == 'failure'`.

### Secrets requeridos en GitHub

| Secret | Uso |
|---|---|
| `CLOUDFLARE_API_TOKEN` | wrangler deploy + rollback |
| `CLOUDFLARE_ACCOUNT_ID` | wrangler deploy + rollback |
| `SMOKE_EMAIL` | login del smoke |
| `SMOKE_PASSWORD` | login del smoke |
| `GROQ_API_KEY` | solo api-ai |

Los 9 callers (`deploy-api-*.yml`) propagan los secrets al reusable.

### Comportamiento ante falla

- **Smoke falla** → rollback automático del worker que estaba deployando. El sha del commit queda en el mensaje del rollback (visible en Cloudflare Dashboard).
- **Test falla** → no se deploya, no se rollbackea. PR queda red.
- **Deploy falla** (ej. Cloudflare API error) → smoke se saltea, rollback se saltea. Producción no se toca.

### Limitación conocida

Los 9 workflows corren en paralelo. Si una API es lenta en deployar y otras ya están en smoke, el smoke puede leer una API en estado mixto. En la práctica las APIs deployan en ventana de ~30s, así que rara vez ocurre. Si pasa, el rollback solo revierte el worker afectado — los demás siguen en green.

---

## Relacionados

- [[Dominio-Leads]]
- [[Dominio-Propiedades]]
- [[Dominio-Reservas]]
- [[Dominio-Marketing]]
- [[API-crm]] · [[API-properties]] · [[API-transactions]]
