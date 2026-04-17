# Backend Hexagonal Refactor — Diseño

**Fecha:** 2026-04-17
**Scope:** `vendepro-backend/` — 8 workers + `@vendepro/core` + `@vendepro/infrastructure`
**Estado:** aprobado para pasar a plan de implementación

## Contexto

El backend es un monorepo hexagonal con 8 workers Hono sobre Cloudflare Workers, un package `core` (domain + application) y un package `infrastructure` (adapters D1/servicios/middleware). La regla de oro es que capas internas no importan de externas: domain no sabe de D1 ni Hono, application solo depende de ports.

Un audit exhaustivo de los 8 workers detectó:

- **46 endpoints violan la capa de presentación** ejecutando `c.env.DB.prepare(...)` directo, conteniendo lógica de negocio inline, instanciando servicios externos con `new` sin use-case, o haciendo operaciones multi-tabla ad-hoc.
- **4 ports sin adapter** (`AppraisalRepository`, `FichaRepository`, `PrefactibilidadRepository`, `ReportRepository`) y **1 port servicio huérfano** (`CalendarSyncService`).
- **Entidades y ports nuevos faltantes** para tablas que se usan desde workers con SQL crudo (`visit_forms`, `password_reset_tokens`, `roles`, `notifications`).
- **Bugs silenciosos en infra**: key `contact_id` duplicada en `D1PropertyRepository.toEntity`; mismatch entre la columna `created_at` (usada en el SQL) y `changed_at` (expuesta por la entidad) en `D1StageHistoryRepository`.
- **Cobertura de tests muy baja**: 4/15 entidades, 1/5 value objects, 1/4 rules, 8/28 use-cases, 0/22 archivos de infraestructura, 2/8 workers con tests e2e.

El worker más crítico es `api-public` (100% SQL crudo, cero ports) y el más grande es `api-properties` (596 líneas, 21 violaciones, mezcla 4 subdominios: properties, appraisals, prefactibilidades, reports).

## Objetivos

1. Todo endpoint de todos los workers sigue el patrón: `const repo = new D1XRepository(c.env.DB); const uc = new SomeUseCase(repo, …); return c.json(await uc.execute(…))`. Cero llamadas `c.env.DB.prepare` en archivos bajo `api-*/src/`.
2. Toda tabla que el backend toca tiene una entidad de dominio, un port de repositorio, y un adapter D1 que implementa el port.
3. Todo use-case tiene test unitario con dependencias mockeadas.
4. Todo adapter D1 tiene test de integración contra D1 real (Miniflare).
5. Toda entidad, value object y regla de dominio con lógica no trivial tiene test unitario.
6. Cada worker tiene tests e2e de sus rutas principales (happy path + permisos + errores clave).

## No-objetivos

- No se cambia el schema de la DB ni se corrige data legacy. Solo se refactoriza el código de acceso.
- No se cambian URLs ni contratos HTTP hacia el frontend. El comportamiento observable queda idéntico (salvo bugs arreglados).
- No se toca el frontend.
- No se implementa `CalendarSyncService` — se elimina el port huérfano (YAGNI). Si la feature de sync con Google Calendar aparece, se diseña junto con el adapter en otro spec.
- No se hacen deploys desde la terminal. CI/CD existente cubre cada worker.

## Reglas de arquitectura (de referencia para el plan)

**Domain** (`core/src/domain/`): puro TypeScript. Prohibido importar de `application`, `infrastructure`, `hono`, `@cloudflare/*`, o cualquier SDK externo.

**Application** (`core/src/application/`): puede importar de `domain`. Solo define ports (interfaces) y use-cases que dependen de esos ports. Prohibido importar de `infrastructure`.

**Infrastructure** (`infrastructure/src/`): puede importar de `core`. Cada repo D1 implementa un port de `core/application/ports/repositories/`. Cada servicio implementa un port de `core/application/ports/services/`. No expone métodos públicos que no estén en un port.

**Presentation** (`api-*/src/`): puede importar de `core` e `infrastructure`. Cada handler debe:
- Parsear request (query/body/params)
- Instanciar adapters e inyectarlos en el use-case
- Ejecutar el use-case
- Serializar respuesta

Prohibido en handlers: `c.env.DB.prepare`, lógica de negocio (validaciones, state transitions, conflict checks), orquestación multi-tabla, llamadas a APIs externas directas (debe ir por service port).

## Enfoque por fases

Enfoque híbrido (opción C aprobada): una fase foundational que desbloquea todo, seguida de una fase por worker, cerrada con limpieza y validación.

### Fase 0 — Foundational

Objetivo: nivelar el core/infra para que las fases 1-8 sean refactor puro sin bloqueos.

**Bugs infra a corregir:**
- `D1PropertyRepository.toEntity`: eliminar key duplicada `contact_id` (l.120 y l.130).
- `D1StageHistoryRepository`: alinear columna `changed_at` entre SQL y entidad. Decisión: la entidad ya expone `changed_at`, el SQL ordenará por `changed_at`.

**Renombres:**
- Carpeta `core/src/application/use-cases/reservations/` → `transactions/`.
- Carpeta `core/tests/use-cases/reservations/` → `transactions/`.
- Actualizar imports en `core/src/application/index.ts` y en `api-transactions/src/index.ts`.

**Entidades nuevas de dominio** (`core/src/domain/entities/`):
- `VisitForm` — formulario público de visitas (tabla `visit_forms` + respuestas `visit_form_responses`).
- `VisitFormResponse` — respuesta individual a un formulario.
- `PasswordResetToken` — token de reseteo con `expires_at`, `used`, validación de vigencia.
- `Role` — rol del sistema (tabla `roles`).
- `Notification` — notificación in-app (tabla `notifications`).

**Ports nuevos** (`core/src/application/ports/repositories/`):
- `VisitFormRepository` — `findPublicBySlug`, `findById`, `save`, `saveResponse`.
- `PasswordResetTokenRepository` — `save`, `findByToken`, `markUsed`.
- `RoleRepository` — `findAll`, `findById`.
- `NotificationRepository` — `findByUserId`.

**Métodos a agregar en ports existentes:**
- `OrganizationRepository` → `findById`, `findByApiKey`, `updateSettings`, `setApiKey`, `getApiKey`.
- `UserRepository` → `findFirstAdminByOrg`, `updateProfile`, `findProfileById`.
- `ActivityRepository` → `findById`.
- `PropertyRepository` → `findPhotos`, `findPhotosByPropertyId`, `update` (full update), `updateStage`, `updateExternalReportTimestamp`, `clearExternalReportTimestamp`, `reorderPhotos`, `addPhoto`, `deletePhoto`.
- `ContactRepository` → `findWithLeadsAndProperties`.
- `CalendarEventRepository` → (verificar que `delete` ya esté).
- `StageHistoryRepository` → alinear con fix de `changed_at`.

**Adapters nuevos** (`infrastructure/src/repositories/`):
- `D1AppraisalRepository` (incluye `appraisal_comparables`: `findComparables`, `addComparable`, `removeComparable`).
- `D1FichaRepository`.
- `D1PrefactibilidadRepository`.
- `D1ReportRepository` (incluye cascade delete de `report_photos`, `report_content`, `report_metrics`; además `findMetrics`, `findContent`, `findPhotos`, `replaceMetrics`, `replaceContent`).
- `D1VisitFormRepository`.
- `D1PasswordResetTokenRepository`.
- `D1RoleRepository`.
- `D1NotificationRepository`.

**Eliminaciones:**
- Borrar port `CalendarSyncService` — huérfano, YAGNI.

**Setup de tests Miniflare:**
- Crear `infrastructure/tests/helpers/d1-test-env.ts` que monta un D1 in-memory con `miniflare`, corre las migraciones de `vendepro-backend/migrations/` y devuelve un `D1Database` binding.
- Agregar `miniflare` como devDep del package `infrastructure`.
- Actualizar `vitest.workspace.ts` si hace falta; usar `poolOptions: { workers: { ... } }` o bien instanciar `Miniflare` manualmente en un beforeAll.

**Tests de dominio nuevos** (`core/tests/domain/`):
- Entidades: `activity`, `appraisal`, `contact`, `ficha-tasacion`, `objective`, `organization`, `prefactibilidad`, `report`, `tag`, `template-block`, `user`, `visit-form`, `password-reset-token`, `role`, `notification`.
- Value objects: `email`, `event-type`, `money`, `property-stage`.
- Rules: `lead-rules`, `property-rules`, `reservation-rules` (o `transaction-rules` tras el rename).

**Criterio de salida Fase 0:** `npm test --workspace=@vendepro/core` pasa; `npm test --workspace=@vendepro/infrastructure` pasa con Miniflare corriendo migraciones y ejercitando al menos 1 adapter; bugs corregidos confirmados con test regression.

### Fases 1-8 — Refactor por worker

Cada fase sigue el mismo patrón:

1. Crear los use-cases faltantes del worker en `core/src/application/use-cases/<dominio>/`.
2. Escribir test unitario para cada use-case con mocks de ports.
3. Refactorizar `api-<worker>/src/index.ts`: cada handler = parsear → instanciar → ejecutar → serializar. Eliminar todo SQL y toda lógica de negocio del archivo.
4. Extraer módulos si el `index.ts` sigue siendo grande (>200 líneas): routers por subdominio (`routes/properties.ts`, `routes/appraisals.ts`, etc.) que exportan un sub-Hono y se montan en `index.ts`. Los handlers siguen siendo wiring thin.
5. Crear tests e2e del worker en `api-<worker>/tests/` con Miniflare + D1 + auth mockeado (siguiendo el patrón de `api-crm/tests/lead-routes.test.ts`).
6. Correr `npm test --filter api-<worker>` y `turbo build --filter api-<worker>` hasta que pase.

**Orden y scope por fase:**

**Fase 1 — api-transactions** (1 violación)
- Nuevo use-case: `CreateSoldPropertyUseCase` en `transactions/`.
- Refactor `POST /sold-properties`.
- Tests: use-case + e2e mínimo.

**Fase 2 — api-auth** (2 violaciones)
- Nuevos use-cases: `RequestPasswordResetUseCase`, `CompletePasswordResetUseCase`.
- Estos usan `PasswordResetTokenRepository`, `UserRepository`, un `EmailService` (port nuevo — `core/src/application/ports/services/email-service.ts`), y `IdGenerator`.
- Adapter nuevo: `EmBlueEmailService` en infra (wrappea la API de emBlue que hoy se llama inline).
- Refactor `POST /forgot-password`, `POST /reset-password`.
- Tests: use-cases + e2e.

**Fase 3 — api-ai** (4 violaciones)
- Nuevos use-cases: `ProcessLeadIntentUseCase`, `TranscribeAudioUseCase`, `ExtractPropertyMetricsUseCase`.
- El use-case recibe el `AIService` por DI en vez de instanciarlo en el handler.
- Decisión sobre `POST /ai/confirm`: verificar con `rg 'ai/confirm' vendepro-frontend/` al iniciar la fase. Si no se usa, eliminar el endpoint. Si se usa, convertirlo en `ConfirmLeadIntentUseCase` con la lógica que persista el intent confirmado.
- Refactor `index.ts` a handlers de 3-5 líneas.
- Tests: use-cases con mocks de `AIService` + e2e.

**Fase 4 — api-admin** (5 violaciones)
- Nuevos use-cases: `GetRolesUseCase`, `GetOrgSettingsUseCase`, `UpdateOrgSettingsUseCase` (incluye chequeo de slug único), `GetUserProfileUseCase`, `UpdateUserProfileUseCase`, `GetUserNotificationsUseCase`.
- Refactor de `/roles`, `/org-settings` GET/PUT, `/profile` GET/PUT, `/notifications`, `/agents/role` (eliminar el lookup duplicado de role).
- Tests: use-cases + e2e.

**Fase 5 — api-crm** (4 violaciones)
- Nuevos use-cases: `CreateLeadWithContactUseCase` (orquesta crear contacto si no existe, luego lead) en `leads/`, `GetContactDetailUseCase` (entidad + leads + properties) en `contacts/`, `CreateTagUseCase` en `contacts/` (o `tags/` si se separa), `GenerateOrgApiKeyUseCase` y `GetOrgApiKeyUseCase` (con masking) en `admin/`.
- Refactor de los 4 endpoints.
- Tests: use-cases + e2e (el worker ya tiene `lead-routes.test.ts`, se expande).

**Fase 6 — api-analytics** (3 violaciones, el dashboard es el más grande)
- Descomponer el endpoint de dashboard de 138 líneas en use-cases compuestos:
  - `GetLeadFunnelUseCase`
  - `GetActivityHeatmapUseCase`
  - `GetPipelineBreakdownUseCase`
  - `GetDashboardUseCase` (compone los anteriores + stats de base)
- Nuevos use-cases: `GetAgentStatsUseCase`, `SearchEntitiesUseCase`.
- Refactor de `/dashboard`, `/agent-stats`, `/search`.
- Tests: use-cases (estos son los que más valor tienen porque son cálculos) + e2e.

**Fase 7 — api-public** (6 violaciones, depende fuerte de Fase 0)
- Nuevos use-cases: `GetPublicReportUseCase`, `GetPublicAppraisalUseCase`, `GetPublicVisitFormUseCase`, `SubmitVisitFormResponseUseCase`, `GetPublicPrefactibilidadUseCase`, `CreatePublicLeadUseCase` (orquesta: validar API key → buscar org → buscar admin → crear contacto → crear lead, con rollback manual si falla alguno porque D1 no tiene transacciones REST).
- Refactor completo del worker: 100% de sus rutas ahora usan adapters.
- Tests: use-cases + e2e contra Miniflare (importante porque no tiene auth, las validaciones son de slug).

**Fase 8 — api-properties** (21 violaciones, el más grande)
- Este worker se reorganiza en sub-routers: `routes/properties.ts`, `routes/photos.ts`, `routes/appraisals.ts`, `routes/prefactibilidades.ts`, `routes/reports.ts`. El `index.ts` monta las piezas y aplica middleware global.
- Nuevos use-cases (property): `UpdatePropertyUseCase` (full multi-field), `GetPropertyDetailUseCase` (prop + photos), `GetPropertyCatalogsUseCase`, `UpdatePropertyStageUseCase` (con validación de transición), `MarkExternalReportUseCase`, `ClearExternalReportUseCase`, `DeletePropertyUseCase`, `UploadPropertyPhotoUseCase`, `ReorderPropertyPhotosUseCase`, `DeletePropertyPhotoUseCase`.
- Nuevos use-cases (appraisals): `GetAppraisalsUseCase`, `GetAppraisalDetailUseCase`, `CreateAppraisalUseCase`, `UpdateAppraisalUseCase`, `DeleteAppraisalUseCase`, `AddAppraisalComparableUseCase`, `RemoveAppraisalComparableUseCase`.
- Nuevos use-cases (prefactibilidades): `GetPrefactibilidadesUseCase`, `GetPrefactibilidadDetailUseCase`, `CreatePrefactibilidadUseCase`.
- Nuevos use-cases (reports): `GetReportsUseCase`, `GetReportDetailUseCase`, `CreateReportUseCase` (incluye metrics + content + competitors), `UpdateReportUseCase` (con permission check + replace de metrics/content), `DeleteReportUseCase` (con cascade + R2 cleanup).
- Tests: use-cases + e2e por sub-router.

**Criterio de salida de cada fase 1-8:** `index.ts` del worker no contiene ni `c.env.DB.prepare` ni `new SomeService(...)` fuera de un use-case; todos los tests nuevos pasan; `turbo build --filter api-<worker>` pasa.

### Fase 9 — Cierre

- Grep final: `rg 'c\.env\.DB\.prepare' vendepro-backend/packages/api-*/src/` debe devolver 0 resultados.
- Grep final: `rg 'new (Groq|Anthropic|JwtAuth|R2Storage|EmBlue)' vendepro-backend/packages/api-*/src/` debe devolver solo instanciaciones dentro de wiring que se pasan a un use-case.
- Eliminar código muerto detectado en las fases (imports sin uso, helpers obsoletos).
- Verificar que `turbo build` y `turbo test` pasan para todo el monorepo.
- Ejecutar un smoke e2e completo de cada worker en Miniflare (ya cubierto por los tests de fase pero se corren todos juntos una vez).

## Estrategia de tests

**Tests de dominio (unit, puros):**
- Ubicación: `core/tests/domain/`.
- Framework: Vitest.
- Sin mocks — son funciones puras y entidades.
- Cubren: constructores, validaciones, state transitions, invariantes, helpers.

**Tests de use-cases (unit con mocks):**
- Ubicación: `core/tests/use-cases/<dominio>/`.
- Framework: Vitest.
- Mocks manuales de los ports (objetos TS con funciones `vi.fn()`).
- Cubren: happy path, fallos de validación, errores del repo, autorización (el use-case rechaza si el `agentId` no corresponde, etc.), side effects (que se llame `idGen.generate`, `repo.save`, etc. con los args correctos).

**Tests de infraestructura (integración contra D1 real vía Miniflare):**
- Ubicación: `infrastructure/tests/repositories/`, `infrastructure/tests/services/`.
- Setup: un helper `createTestDB()` que levanta Miniflare con las migraciones aplicadas y devuelve un `D1Database`. Cada test corre en un DB nuevo (o con `TRUNCATE`/DELETE por tabla).
- Cubren: que el adapter inserta/lee/actualiza como declara el port, que los `toEntity` mapean bien, que las queries con JOIN devuelven las columnas esperadas.
- Para servicios: `JwtAuthService` se testea con tokens reales (sign/verify round-trip). Los servicios que llaman APIs externas (`GroqAIService`, `AnthropicAIService`, `EmBlueEmailService`) se testean con `msw` o `fetch` mock — NO se llaman APIs reales en CI.

**Tests e2e por worker:**
- Ubicación: `api-<worker>/tests/`.
- Setup: Miniflare con el worker cargado + D1 con schema + auth mockeado (middleware reemplazado por uno que setea `userId`/`orgId`/`userRole`).
- Cubren: un request por ruta en happy path, auth rechazada (401), not found (404), bad request (400).
- Siguen el patrón de `api-crm/tests/lead-routes.test.ts` (ya existente).

**Estrategia de fixtures:**
- Helper `infrastructure/tests/helpers/fixtures.ts` con factories: `createTestOrg()`, `createTestUser()`, `createTestLead()`, etc. Cada factory inserta en D1 y devuelve la entidad.

## Estructura final esperada

```
core/
  src/
    domain/
      entities/        15 actuales + 5 nuevas (VisitForm, VisitFormResponse, PasswordResetToken, Role, Notification)
      value-objects/   sin cambios
      rules/           sin cambios
    application/
      ports/
        repositories/  15 actuales con métodos nuevos + 4 nuevos (VisitForm, PasswordResetToken, Role, Notification)
        services/      actuales + EmailService, - CalendarSyncService
      use-cases/
        auth/         + RequestPasswordReset, CompletePasswordReset
        leads/        + CreateLeadWithContact
        contacts/     + GetContactDetail, CreateTag
        admin/        (ver abajo)
        properties/   + 10 use-cases nuevos
        transactions/ renombrado desde reservations/ + CreateSoldProperty
        calendar/     sin cambios
        admin/        + 8 use-cases nuevos (Roles, OrgSettings GET/PUT, Profile GET/PUT, Notifications, OrgApiKey GET/POST)
        dashboard/    + 5 use-cases nuevos
        ai/           nuevo, 3 use-cases
        appraisals/   nuevo, 7 use-cases
        prefactibilidades/ nuevo, 3 use-cases
        reports/      nuevo, 5 use-cases
        public/       nuevo, 6 use-cases
  tests/
    domain/           +15 nuevos tests
    use-cases/        +40 nuevos tests

infrastructure/
  src/
    repositories/     12 actuales (con métodos nuevos) + 8 nuevos
    services/         actuales + EmBlueEmailService, - CalendarSyncService (no existía adapter igual)
    middleware/       sin cambios
  tests/              nuevo, ~20 tests de integración con Miniflare

api-*/
  src/index.ts        todos refactorizados, ninguno llama c.env.DB.prepare
  src/routes/         nuevo solo en api-properties (sub-routers por subdominio)
  tests/              nuevos tests e2e en los 6 workers que no tenían
```

## Riesgos

- **Miniflare + migraciones**: el helper aplica `vendepro-backend/schema.sql` (ya consolidado) directamente sobre el D1 in-memory en un `beforeAll`. Si hay semillas necesarias (roles, operation_types, etc.) se cargan desde fixtures. Evitamos correr migraciones 001-007 en orden para mantener el setup simple.
- **D1 no tiene transacciones HTTP**: use-cases como `CreatePublicLead` (contacto + lead) no pueden ser transaccionales. Mitigación: compensación manual en el use-case (si falla la segunda operación, borrar lo creado por la primera) + tests específicos de rollback.
- **Renombre `reservations/` → `transactions/`**: rompe imports. Mitigación: grep exhaustivo post-rename, CI catch.
- **Fase 8 es grande**: 596 líneas y 21 violaciones en un worker. Mitigación: sub-routers antes de empezar los use-cases, así cada pedazo es manejable.
- **Frontend**: ninguna ruta cambia contratos. Riesgo mínimo, pero conviene un smoke manual del frontend tras cada worker refactorizado.

## Criterios de éxito globales

- `rg -c 'c\.env\.DB\.prepare' vendepro-backend/packages/api-*/src/` → 0.
- Cobertura: entidades 15/15, VOs 5/5, rules 4/4, use-cases ~68/68, adapters con al menos 1 test de integración cada uno.
- `npm test` (turbo root) verde.
- `turbo build` verde.
- Los 8 workers deployan por sus workflows de GitHub Actions sin cambios en CI.
