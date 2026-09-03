# 🎨 Dominio: Landings

Builder visual de landing pages para captura de leads o presentación de propiedades. Multi-versión, AI-edit, publicación con review.

## Tipos

- `lead_capture`: form genérico de captura
- `property`: ficha de propiedad
- `agent_profile`: página personal del agente inmobiliario (Feature 07, 🟢) — foto, bio, credenciales, zonas, especialidades, FAQ y CTA de WhatsApp, en `/a/<org>/<agente>`. `LandingKind` en `core/src/domain/entities/landing.ts:7`.

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
  - `kind` (lead_capture|property|agent_profile), `slug_base`, `slug_suffix`, `full_slug` (computed)
  - `status`, `blocks` (array validado con Zod)
  - `brand_voice`, `lead_rules` (JSON: assigned_agent_id, tags, campaign, notify_channels)
  - SEO: `seo_title`, `seo_description`, `og_image_url`
  - Pub: `published_version_id`, `published_at`, `published_by`
  - Métodos: `replaceBlocks(blocks)`, `transitionStatus(next)`, `markPublished(...)`, `updateMetadata(...)`, `setReviewNote(note)`
  - Invariante de lead-form (`assertLeadFormInvariant`, `domain/rules/landing-rules.ts:71-79`, llamada desde `create()` y `replaceBlocks()`) **depende del kind**: `lead_capture`/`property` exigen exactamente 1 bloque `lead-form`; `agent_profile` admite 0 o 1 — el perfil se puede vender sin form si el agente prefiere derivar todo a WhatsApp.

- **`LandingTemplate`** (`domain/entities/landing-template.ts`)
  - Templates globales (`org_id=NULL`) o de la org
  - Seeds globales: `emprendimiento_premium`, `propiedad_clasica`, `captacion_rapida`

- **`LandingVersion`** — snapshot histórico (label: auto-save | manual-save | ai-edit | publish)

- **`LandingEvent`** — analytics público (pageview | cta_click | form_start | form_submit) con UTM y visitorId

## Bloques

Definidos en `domain/value-objects/block-schemas.ts` con schemas Zod. 12 tipos (`BLOCK_TYPES`, `block-schemas.ts:131-145`):

- `hero`, `hero-split`
- `features-grid`, `amenities-chips`
- `gallery`, `benefits-list`
- `lead-form` (invariante: name + phone obligatorios)
- `footer`
- **`agent-hero`** — foto, headline, bio y hasta 3 CTAs
- **`agent-credentials`** — matrícula, años de experiencia, zonas (máx 12), especialidades (máx 8), stats (máx 4)
- **`faq`** — 2 a 12 preguntas/respuestas
- **`cta-whatsapp`** — título, teléfono, `message_template`, botón

Cada bloque tiene su tipo Zod estricto. La validación corre al guardar y al editar con IA.

El envelope del bloque (`BlockSchema`, `block-schemas.ts:165-180`) suma un campo opcional **`binding: z.literal('agent_profile')`** (`block-schemas.ts:178`): marca que ese bloque se rellena en la lectura pública con los datos vivos del perfil del agente. Ver siguiente sección.

## Binding vivo (agent_profile) — decisión de arquitectura

Los bloques con `binding: 'agent_profile'` (hoy: `agent-hero`, `agent-credentials`, `cta-whatsapp`, `footer`) se completan con los datos del perfil **en el momento de la lectura pública**, no al crear la landing.

Esto es **deliberadamente distinto** del `binding_mode` de [[Dominio-Tasaciones]], que snapshotea los datos al crear la tasación (y por eso arrastra la deuda conocida de `data.agent = null` en la página pública — ver [[Roadmap-estado-implementacion]] § 00c). Con el binding vivo, el agente edita su perfil una sola vez en `/perfil` y **todas** sus landings de kind `agent_profile` se actualizan solas, sin tocar la landing.

- **Mapa de bindings** — `domain/value-objects/agent-bindings.ts`, `AGENT_BINDINGS`: por tipo de bloque, qué campo del bloque sale de qué campo del perfil. Prefijo `user.` = viene de la tabla `users` (ej. `user.full_name`, `user.photo_url`); sin prefijo = viene de `agent_profiles` (ej. `headline`, `bio`, `license`).
- **`resolveAgentBindings(blocks, ctx)`** — 3 reglas:
  1. Solo actúa si `block.binding === 'agent_profile'`.
  2. Solo pisa el campo cuando el valor del perfil **no está vacío** (`null`/`undefined`/`''`/`[]`) — un campo vacío deja el valor editorial del bloque como fallback.
  3. Revalida el bloque mergeado contra el Zod real; si el merge da inválido, devuelve el bloque **original** — la landing pública nunca se rompe por un perfil incompleto.
  - Clona los arrays (`zones`, `specialties`, `stats`) al asignarlos, para que nadie mute el estado interno de la entidad `AgentProfile` a través del bloque resuelto.
- Corre **únicamente** en la lectura pública (`GetPublicAgentLandingUseCase`). La IA de edición de bloques (`EditBlockWithAI`) solo propone contenido — nunca resuelve bindings.
- Espejo manual en frontend: `vendepro-frontend/src/lib/landings/agent-bindings.ts`. Backend (Workers) y frontend (Next.js standalone) no comparten paquete, así que es una duplicación deliberada — protegida por el test anti-desincronización `agent-bindings.sync.test.ts` (lee el archivo fuente del backend con `readFileSync`, evalúa el literal `AGENT_BINDINGS` como objeto JS y lo compara con `toEqual` contra el mapa del frontend).

## Slug

`domain/value-objects/landing-slug.ts`:
- `slug_base`: 3-60 chars, a-z0-9 + guiones
- `slug_suffix`: 5 chars del alfabeto sin ambigüedad (sin 0, o, 1, l, i) — generado cripto
- `full_slug = slug_base-slug_suffix`

URL pública: `/l/<full_slug>` o subdominio `<full_slug>.landings.vendepro.com.ar` (rewrite via middleware Next).

## Perfil de agente y landing pública `/a/<org>/<agente>`

- **`AgentSlug`** (`domain/value-objects/agent-slug.ts`): 3-60 chars, `^[a-z0-9]+(?:-[a-z0-9]+)*$` (sin guión al borde). `slugifyName(fullName)` delega en el `slugify()` de `shared/utils.ts` para proponer un slug a partir del nombre; la unicidad la garantiza el índice `(org_id, slug)` de `agent_profiles`, no el value object.
- **`AgentProfile`** (`domain/entities/agent-profile.ts`): entidad 1:1 con `users`. Ver campos completos y tabla D1 en [[Dominio-Usuarios-Org]]. `update()` filtra las keys con valor `undefined` antes del spread — así `null` en el patch significa "borrar el campo" y `undefined` significa "no tocar", que es lo que necesita un PUT parcial desde el form de `/perfil`.
- **`GetPublicAgentLandingUseCase`** (`application/use-cases/landings/get-public-agent-landing.ts`) sirve `GET /a/:orgSlug/:agentSlug` con **5 puertas**, todas devuelven el mismo 404 genérico (no filtra por cuál falló, para no filtrar existencia):
  1. La org existe (`findBySlug`).
  2. El perfil existe **y** `is_public = 1` (kill-switch).
  3. El usuario dueño del perfil está activo, no borrado, **y `user.org_id === org.id`** — chequeo obligatorio porque `UserRepository.findProfileById` no filtra por org.
  4. Existe una landing **publicada** de kind `agent_profile` para ese agente (`findPublishedByAgentAndKind`).
  5. Los bloques pasan por `resolveAgentBindings` y se filtran por `visible`.
- **Template de sistema `tpl_agent_profile_v1`** (migración `049_landing_template_agent_profile.sql`, `org_id NULL`, global para todas las orgs): 9 bloques en orden — `agent-hero` → `agent-credentials` → `features-grid` → `benefits-list` → `gallery` → `faq` → `cta-whatsapp` → `lead-form` → `footer`. Los 4 bindeados (`agent-hero`, `agent-credentials`, `cta-whatsapp`, `footer`) llevan `binding: 'agent_profile'` y datos placeholder — el `photo_url` del hero es un placeholder válido a propósito, porque `users.photo_url` es nullable y Zod exige URL. `CreateLandingFromTemplateUseCase` hereda el `kind` del template hacia la landing creada. Protegido por `core/tests/domain/landing-template-agent-profile-seed.test.ts`, que lee la migración con `readFileSync` y valida el `blocks_json` contra el Zod real — mismo precedente que `automation-seed.test.ts` para la migración 044.
- **URL pública**: `/a/<orgSlug>/<agentSlug>`, distinta de `/l/<full_slug>`. `GetPublicLandingUseCase` (el de `/l/:slug`) devuelve además `kind` y `agent_public_path` — este último es `/a/<orgSlug>/<agentSlug>` cuando la landing es `agent_profile` y el agente tiene perfil público, para que `/l/:slug` pueda emitir un `<link rel="canonical">` hacia la ruta de agente y evitar SEO duplicado.

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
- Public: `GetPublicLanding`, `GetPublicAgentLanding`, `RecordLandingEvent`, `SubmitLeadFromLanding`
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
- `GET /a/:orgSlug/:agentSlug` — `GetPublicAgentLandingUseCase` (perfil de agente)

[[API-admin]]:
- `GET/PUT /profile/public` — perfil de agente (`GetAgentProfileUseCase`/`UpdateAgentProfileUseCase`)

[[API-ai]]:
- `POST /landings/:id/edit-block` (con rate limit)

## Frontend

- `/landings` — lista (`LandingCard`, `NewLandingModal`) — `landingKindLabel()` (`lib/landings/kind-label.ts`, switch exhaustivo sobre `LandingKind`, sin `default`: agregar un kind nuevo rompe el build hasta cubrirlo) etiqueta el kind en `LandingCard`, `LandingMobileInfo` y `NewLandingModal`.
- `/landings/[id]` — editor (drag-drop, inspector, AI panel, versions drawer). Los campos bindeados (`binding: 'agent_profile'`) salen **read-only** en `InspectorPanel` — se reemplazan por un aviso ("Se sincroniza con tu perfil público. Editalo en Perfil.") en vez de un input editable.
- `/landings/[id]/preview` — preview público
- **`/a/[org]/[slug]`** (`src/app/a/[org]/[slug]/`, con `page.tsx`, `loading.tsx`, `not-found.tsx`) — landing pública de agente. `revalidate = 60`. `'/a/'` está en `PUBLIC_PREFIXES` de `src/middleware.ts` (si una landing de agente redirige a `/login`, el problema está ahí).
- `/perfil` — sección "Perfil público" (`PerfilPublicoForm.tsx`, 508 líneas): slug con aviso de cambio de URL, URL pública con botón de copiar, aviso de latencia ("pueden tardar hasta un minuto" — por el `revalidate=60`), editores de chips (zonas/especialidades) y de stats. El PUT manda el set **completo** de campos editables (no es un patch parcial desde la UI, aunque el dominio sí soporte updates parciales). Ver [[Dominio-Usuarios-Org]].
- `/marketing` — hub

Componentes principales: `EditorToolbar`, `BlockListSidebar`, `BlockRenderer`, `InspectorPanel`, `ConfigDrawer`, `VersionsDrawer`, `PublishReviewBanner`, `StatusBadge`, `ImageUpload`, `PropertyPhotoPicker`.

Bloques editables y renderer en `components/landings/blocks/` (12 componentes, usados tanto por el editor como por la landing pública vía `BlockRenderer`). Los 4 de agente (`AgentHeroBlock`, `AgentCredentialsBlock`, `FaqBlock`, `CtaWhatsappBlock`) están ahí también. Ver [[Frontend-editor-landings]].

## Cross-uso

- Cuando una landing es tipo `property`, se puede clonar como template de tasación (`CloneLandingAsTasacion` + flag `template_type` en `landings.template_type`).
- Las landings de tasaciones se renderizan reusando el motor de bloques.

## Deuda conocida

- **Fakes de `LandingRepository` pasados con `as any` en tests de use cases** (ej. `core/tests/use-cases/landings/get-public-agent-landing.test.ts:42`): TypeScript no fuerza conformidad de interfaz sobre el fake, así que agregar un método al puerto (como `findPublishedByAgentAndKind`, que sumó este feature) no rompe ningún fake existente — el test sigue compilando aunque el fake no implemente el método nuevo, y solo se nota en runtime si el use case lo llama. Deuda preexistente del repo, no específica de este feature.
- **Superficies públicas eximidas del design system**: `doc/ds-visual-rules.md:161-168` exime a `landings/blocks/**` (junto con `landings/public/**` y los renderers públicos de tasaciones) de las reglas estrictas del DS — son páginas que ve un cliente externo, con identidad visual propia por org/agente, no el chrome del CRM. Aun así los 4 bloques nuevos de agente usan el DS (`Heading`/`Text`/`Card`/`Button`/`WhatsAppButton`), más estricto que los bloques hermanos preexistentes (`HeroBlock`, `HeroSplitBlock` usan `<h1>`/`<p>`/`<a>` crudos).

## Relacionados

- [[Dominio-Tasaciones]] (templates compartidos; contraste de `binding_mode` snapshot vs binding vivo)
- [[Dominio-Marketing]] (landings disparan eventos)
- [[Dominio-Usuarios-Org]] (`agent_profiles`, perfil público)
- [[Frontend-editor-landings]]
