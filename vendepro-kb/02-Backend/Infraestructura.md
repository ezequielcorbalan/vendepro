# 🔌 Infraestructura

Capa que implementa los **ports** del dominio (interfaces) con adaptadores concretos a Cloudflare D1, R2, JWT, AI providers, etc. Vive en `packages/infrastructure/src/`.

## Repositories (D1)

32 adaptadores en `src/repositories/`. Cada uno implementa un port de `@vendepro/core/application/ports/repositories`.

| Repo | Tablas D1 que toca | Port |
|---|---|---|
| `d1-user-repository.ts` | `users` | UserRepository |
| `d1-organization-repository.ts` | `organizations` | OrganizationRepository |
| `d1-property-repository.ts` | `properties`, `property_photos`, `property_price_history`, `operation_types`, `commercial_stages`, `property_statuses` | PropertyRepository |
| `d1-lead-repository.ts` | `leads` | LeadRepository |
| `d1-contact-repository.ts` | `contacts` | ContactRepository |
| `d1-activity-repository.ts` | `activities` | ActivityRepository |
| `d1-calendar-repository.ts` | `calendar_events` | CalendarRepository |
| `d1-appraisal-repository.ts` | `appraisals`, `appraisal_comparables` | AppraisalRepository |
| `d1-appraisal-template-repository.ts` | `appraisal_templates` | AppraisalTemplateRepository |
| `d1-appraisal-pdf-repository.ts` | `appraisal_pdfs` | AppraisalPdfRepository |
| `d1-reservation-repository.ts` | `reservations` | ReservationRepository |
| `d1-tag-repository.ts` | `tags`, `lead_tags` | TagRepository |
| `d1-stage-history-repository.ts` | `stage_history` | StageHistoryRepository |
| `d1-objective-repository.ts` | `agent_objectives` | ObjectiveRepository |
| `d1-role-repository.ts` | `roles` | RoleRepository |
| `d1-notification-repository.ts` | `notifications` | NotificationRepository |
| `d1-password-reset-token-repository.ts` | `password_reset_tokens` | PasswordResetTokenRepository |
| `d1-template-block-repository.ts` | `tasacion_template_blocks` | TemplateBlockRepository |
| `d1-ficha-repository.ts` | `fichas_tasacion` | FichaRepository |
| `d1-prefactibilidad-repository.ts` | `prefactibilidades` | PrefactibilidadRepository |
| `d1-report-repository.ts` | `reports`, `report_metrics`, `report_content`, `report_photos`, `competitor_links` | ReportRepository |
| `d1-visit-form-repository.ts` | `visit_forms`, `visit_form_responses` | VisitFormRepository |
| `d1-property-visit-form-repository.ts` | `property_visit_forms` | PropertyVisitFormRepository |
| `d1-landing-repository.ts` | `landings`, `landing_versions` | LandingRepository |
| `d1-landing-template-repository.ts` | `landing_templates` | LandingTemplateRepository |
| `d1-landing-version-repository.ts` | `landing_versions` | LandingVersionRepository |
| `d1-landing-event-repository.ts` | `landing_events` | LandingEventRepository |
| `d1-analytics-report-repository.ts` | reportes derivados (queries cross-tabla) | AnalyticsReportRepository |
| `d1-meta-integration-repository.ts` | `meta_integration` | MetaIntegrationRepository |
| `d1-meta-event-log-repository.ts` | `meta_event_log` | MetaEventLogRepository |
| `d1-stage-event-mapping-repository.ts` | `stage_event_mappings` | StageEventMappingRepository |
| `d1-org-variable-repository.ts` | `org_variables` | OrgVariableRepository |

Ver tablas en [[DB-overview]].

## Services

14 servicios en `src/services/`. Implementan ports de `@vendepro/core/application/ports/services`.

Ver [[Servicios-externos]].

## Middleware

3 archivos en `src/middleware/`:

### `auth-middleware.ts`
- Lee header `Authorization: Bearer <token>`
- Verifica JWT con `JWT_SECRET` usando `jose`
- Setea en context: `userId`, `userEmail`, `userRole`, `orgId`
- 401 si falta o es inválido

### `cors-middleware.ts`
- Permite orígenes:
  - `localhost:3000`, `localhost:3001`
  - `vendepro.com.ar`
  - `*.api.vendepro.com.ar`
  - `*.pages.dev`
  - `*.landings.vendepro.com.ar` (para subdominios de landings)
- Headers permitidos: `Authorization`, `Content-Type`, `X-API-Key`
- `credentials: true`

### `error-handler.ts`
- Captura excepciones del handler
- Si es `DomainError`: retorna `{ error: { code, message, ...fields } }` con su `httpStatus`
- Si es otra: 500 con `{ error: { code: 'INTERNAL', message: '...' } }`
- Loguea con `console.error` (capturado por wrangler tail)

## ID Generator

`infrastructure/src/id-generator/crypto-id-generator.ts` implementa `IdGeneratorPort`:

```typescript
generate() // 32 hex chars random (crypto.getRandomValues)
```

## Index export

`src/index.ts` re-exporta todos los repos, services y middlewares para que cada worker los importe con `import { D1LeadRepository, JwtAuthService } from '@vendepro/infrastructure'`.
