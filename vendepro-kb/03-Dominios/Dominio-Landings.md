# 🎨 Dominio: Landings

Builder visual de landing pages para captura de leads o presentación de propiedades. Multi-versión, AI-edit, publicación con review.

## Tipos

- `lead_capture`: form genérico de captura
- `property`: ficha de propiedad

## Pipeline de publicación

```
draft → pending_review → published → archived
   ↕            ↕              ↕
   └────────────┴──────────────┘
```

Definido en `domain/value-objects/landing-status.ts` con transiciones validadas.

Reglas (`domain/rules/landing-rules.ts`):
- `canEditLanding(actor, ref)` → false si published o archived
- `canRequestPublish(actor, ref)` → si draft + (admin u owner)
- `canPublish(actor)` → si admin
- `canRollback(actor, ref)` → draft o pending_review + (admin u owner)
- `canManageTemplates(actor)` → admin

Constantes:
- `VERSION_RETENTION_NON_PUBLISH=20` (versiones no publicadas)
- `AI_EDITS_PER_MINUTE=30`
- `AUTOSAVE_THROTTLE_MS=30000`

## Entidades

- **`Landing`** (`domain/entities/landing.ts`)
  - `id`, `org_id`, `agent_id`, `template_id`
  - `kind` (lead_capture|property), `slug_base`, `slug_suffix`, `full_slug` (computed)
  - `status`, `blocks` (array validado con Zod)
  - `brand_voice`, `lead_rules` (JSON: assigned_agent_id, tags, campaign, notify_channels)
  - SEO: `seo_title`, `seo_description`, `og_image_url`
  - Pub: `published_version_id`, `published_at`, `published_by`
  - Métodos: `replaceBlocks(blocks)` (invariante: exactamente 1 lead-form), `transitionStatus(next)`, `markPublished(...)`, `updateMetadata(...)`, `setReviewNote(note)`

- **`LandingTemplate`** (`domain/entities/landing-template.ts`)
  - Templates globales (`org_id=NULL`) o de la org
  - Seeds globales: `emprendimiento_premium`, `propiedad_clasica`, `captacion_rapida`

- **`LandingVersion`** — snapshot histórico (label: auto-save | manual-save | ai-edit | publish)

- **`LandingEvent`** — analytics público (pageview | cta_click | form_start | form_submit) con UTM y visitorId

## Bloques

Definidos en `domain/value-objects/block-schemas.ts` con schemas Zod:

- `hero`, `hero-split`
- `features-grid`, `amenities-chips`
- `gallery`, `benefits-list`
- `lead-form` (invariante: name + phone obligatorios)
- `footer`

Cada bloque tiene su tipo Zod estricto. La validación corre al guardar y al editar con IA.

## Slug

`domain/value-objects/landing-slug.ts`:
- `slug_base`: 3-60 chars, a-z0-9 + guiones
- `slug_suffix`: 5 chars del alfabeto sin ambigüedad (sin 0, o, 1, l, i) — generado cripto
- `full_slug = slug_base-slug_suffix`

URL pública: `/l/<full_slug>` o subdominio `<full_slug>.landings.vendepro.com.ar` (rewrite via middleware Next).

## Tablas D1

Ver [[DB-overview]]:
- `landings`
- `landing_templates`
- `landing_versions`
- `landing_events`

## Use cases (~27)

`packages/core/src/application/use-cases/landings/`:
- CRUD: `CreateLandingFromTemplate`, `ListLandings`, `GetLanding`
- Edit: `UpdateLandingMetadata`, `UpdateLandingBlocks`, `AddBlock`, `RemoveBlock`, `ReorderBlocks`, `ToggleBlockVisibility`
- AI: `EditBlockWithAI`
- Pub: `RequestPublish`, `PublishLanding`, `RejectPublishRequest`, `RollbackLanding`
- Archive: `ArchiveLanding`, `UnarchiveLanding`
- Public: `GetPublicLanding`, `RecordLandingEvent`, `SubmitLeadFromLanding`
- Templates: `CreateTemplate`, `UpdateTemplate`, `ListTemplates`, `ListTasacionTemplates`
- Special: `CloneLandingAsTasacion`, `GetLandingAnalytics`

## Endpoints

[[API-crm]] (autenticado, ~22 endpoints):
- `GET/POST /landings`, `GET/PATCH /landings/:id`
- `PATCH/POST/DELETE /landings/:id/blocks[/:blockId]`, `POST /blocks/reorder`
- `PATCH /landings/:id/blocks/:blockId/visibility`
- `GET /landings/:id/versions`, `POST /landings/:id/rollback/:versionId`
- `POST /landings/:id/{request-publish,publish,reject-publish,archive,unarchive}`
- `GET /landings/:id/analytics?rangeDays=`
- `GET/POST/PATCH /landing-templates`

[[API-public]]:
- `GET /l/:slug`
- `POST /l/:slug/submit` (lead) + marketing event
- `POST /l/:slug/event` (analytics)

[[API-ai]]:
- `POST /landings/:id/edit-block` (con rate limit)

## Frontend

- `/landings` — lista (`LandingCard`, `NewLandingModal`)
- `/landings/[id]` — editor (drag-drop, inspector, AI panel, versions drawer)
- `/landings/[id]/preview` — preview público
- `/marketing` — hub

Componentes principales: `EditorToolbar`, `BlockListSidebar`, `BlockRenderer`, `InspectorPanel`, `ConfigDrawer`, `VersionsDrawer`, `PublishReviewBanner`, `StatusBadge`, `ImageUpload`, `PropertyPhotoPicker`.

Bloques editables y renderer en `components/landings/{blocks,renderer/blocks}`. Ver [[Frontend-editor-landings]].

## Cross-uso

- Cuando una landing es tipo `property`, se puede clonar como template de tasación (`CloneLandingAsTasacion` + flag `template_type` en `landings.template_type`).
- Las landings de tasaciones se renderizan reusando el motor de bloques.

## Relacionados

- [[Dominio-Tasaciones]] (templates compartidos)
- [[Dominio-Marketing]] (landings disparan eventos)
- [[Frontend-editor-landings]]
