# Landings con IA — Diseño

**Fecha:** 2026-04-18
**Scope:** `vendepro-frontend/` (editor + renderer público) + `vendepro-backend/` (extensiones a `api-crm`, `api-ai`, `api-public`, 4 tablas nuevas en D1, adapters y use-cases nuevos en core/infrastructure)
**Estado:** aprobado para pasar a plan de implementación

## Contexto

VendéPro es un CRM inmobiliario multi-tenant. Hoy las rutas públicas son reportes (`/r/[slug]`), tasaciones (`/t/[slug]`), visitas (`/v/[slug]`) y prefactibilidades (`/p/[slug]`), todas con contenido derivado de entidades del CRM.

Se necesita un feature nuevo de **landings** para cubrir dos escenarios:

- **Captación de leads** (`lead_capture`): páginas tipo "Tasá tu propiedad gratis" o "Vendé con nosotros" para campañas de captación.
- **Propiedad/Emprendimiento** (`property`): página comercial rica para una propiedad o desarrollo puntual. El contenido es independiente del registro de la propiedad en el CRM (no hay binding ni sync bidireccional).

Ambos tipos siempre incluyen un formulario de contacto que crea un `lead` en el pipeline existente. El usuario final del feature es el agente inmobiliario o el admin, que arranca siempre desde un **template curado por el equipo VendéPro** (nunca desde cero) y edita con ayuda de IA usando **Groq** (`llama-3.3-70b-versatile`).

Las landings se publican en subdominios wildcard `<slug>.landings.vendepro.com.ar` con slug user-picked + sufijo aleatorio corto para evitar enumeración.

## Objetivos

1. Permitir al agente crear una landing eligiendo un template del catálogo, editarla con inspector + chat IA, y solicitarle al admin que la publique.
2. Respetar el patrón hexagonal existente: entidades + value objects + reglas + ports + use-cases en `@vendepro/core`, adapters (D1, Groq, R2) en `@vendepro/infrastructure`, workers como orquestadores puros.
3. Reusar los 8 workers y recursos CF existentes. No crear workers nuevos ni APIs nuevas.
4. Cumplir la regla del proyecto: **no deploys desde terminal**. Infra manual via CF dashboard; código via GHA.
5. Entregar analytics básico (pageviews, funnel, UTM) embebido en el detalle de la landing.
6. Dejar preparado el feature para fase 2 de **dominios custom** del cliente sin rediseños mayores.

## No-objetivos

- No se implementan dominios custom del cliente en v1 (fase 2: tabla `landing_domains` + CF SaaS Custom Hostnames).
- No hay binding bidireccional entre una landing `property` y el registro de la propiedad en el CRM. Sí se permite **importar fotos** de una propiedad como starting material (copia de URLs, no referencia).
- La IA no modifica URLs de imágenes ni sube imágenes; solo edita texto y campos escalares.
- No hay A/B testing, schedule-publish, multi-idioma, export HTML estático, pixels externos, colaboración multi-user, ni templates creados por end-users en v1.
- No se usa dark mode en el editor. El editor debe respetar el look & feel existente del frontend (Tailwind, Poppins, colores de marca `#ff007c` y `#ff8017`, fondo claro, componentes consistentes con el resto de la app).
- No se modifica el schema de la tabla `leads`. El `landing_id` y UTMs viajan en `metadata_json`.

## Decisiones clave

| # | Decisión |
|---|----------|
| 1 | Dos tipos de landing: `lead_capture` y `property`. |
| 2 | Flujo de edición mixto: chat global + edición por bloque (click-in-block). |
| 3 | Contenido 100% freeform (no bindeado a propiedad). Siempre con formulario. |
| 4 | Submissions van a `leads` con `source='landing:<full_slug>'` + reglas configurables por landing (agente asignado, tags, campaña, notificación). |
| 5 | Arquitectura híbrida: tipos de bloque y shapes en código (TypeScript + Zod); catálogo de templates en D1 (seed inicial de 3 globales, admin puede agregar más). |
| 6 | URL pública: subdominio `<slug>.landings.vendepro.com.ar`. `full_slug = slug_base + '-' + slug_suffix(5 chars random)`. |
| 7 | Permisos: agentes crean drafts; solo admin publica (approval flow con estado `pending_review`). |
| 8 | Lifecycle: `draft` → `pending_review` → `published` → `archived`. Versionado con rollback. |
| 9 | Assets: R2 upload + URL externa + reutilizar fotos desde propiedad del CRM (copia de URL). |
| 10 | Catálogo de bloques v1: `hero`, `hero-split`, `features-grid`, `amenities-chips`, `gallery`, `benefits-list`, `lead-form` (required), `footer`. |
| 11 | Analytics v1: pageviews, cta_click, form_start, form_submit, con UTM + referrer. |
| 12 | Contexto de IA: brand voice editable por landing + schema del bloque + contenido actual + prompt del usuario. Idioma lockeado a español rioplatense. |

## Arquitectura hexagonal

Cada capa con su responsabilidad. Los workers no tocan D1 ni llaman a Groq/R2 directamente; solo instancian el use-case inyectando adapters.

### `@vendepro/core` — dominio puro

- **Entidades** (`domain/entities/`): `Landing`, `LandingTemplate`, `LandingVersion`, `LandingEvent`.
- **Value objects** (`domain/value-objects/`):
  - `LandingStatus` — union tipado (`draft | pending_review | published | archived`).
  - `LandingSlug` — encapsula `slug_base` + `slug_suffix`, validación de formato y unicidad conceptual.
  - `Block` — discriminated union de las 8 variantes.
- **Rules** (`domain/rules/landing-rules.ts`): transiciones válidas de estado por rol, invariante "lead-form presente y único", política de snapshots.
- **Ports** (`application/ports/repositories/`): `LandingRepository`, `LandingTemplateRepository`, `LandingVersionRepository`, `LandingEventRepository`.
- **Services**: se amplía `AIService` con `editLandingBlock({ blockType, blockData, prompt, brandVoice })` y `editLandingGlobal({ blocks, prompt, brandVoice })`. `StorageService` y `EmailService` se reusan.
- **Use cases** (`application/use-cases/landings/`):
  - `CreateLandingFromTemplate`, `UpdateLandingBlocks`, `ReorderBlocks`, `ToggleBlockVisibility`, `AddBlock`, `RemoveBlock`.
  - `EditBlockWithAI` (scope=`block` | `global`).
  - `RequestPublish`, `Publish` (admin), `RejectPublishRequest`, `Archive`, `Unarchive`.
  - `Rollback` (restore de una versión previa al working copy).
  - `RecordLandingEvent`, `SubmitLeadFromLanding`.
  - `ListTemplates`, `CreateTemplate`, `UpdateTemplate` (admin).
  - `GetPublicLanding` (usado por api-public).
  - `GetLandingAnalytics` (KPIs, funnel, UTMs).

Tests unitarios en `core/tests/use-cases/landings/` cubren cada use-case con mocks de los ports.

### `@vendepro/infrastructure` — adapters

- **Repositorios D1** (`repositories/`):
  - `d1-landing-repository.ts`
  - `d1-landing-template-repository.ts`
  - `d1-landing-version-repository.ts`
  - `d1-landing-event-repository.ts`
- **AI service**: extender `GroqAIService` con métodos `editLandingBlock` y `editLandingGlobal`. Ambos usan `llama-3.3-70b-versatile` con `response_format: 'json_object'`, validan el output contra el schema Zod del bloque y aplican retry correctivo una sola vez.
- **Storage**: `R2StorageService` se reusa con prefix `landings/<landing_id>/`.
- **Email**: `EmblueEmailService` se reusa para notificaciones de submission y de approval requests.

### API Workers — orquestación

Se agregan rutas a los workers existentes. No se crean workers nuevos.

- **api-crm** (autenticado):
  - `GET /landings` — listado del agente + filtros por status.
  - `GET /landings/:id` — detalle con working copy.
  - `POST /landings` — desde template: `{ templateId, slugBase, brandVoice?, seo? }`.
  - `PATCH /landings/:id` — actualiza metadata (slug, SEO, brand_voice, lead_rules).
  - `PATCH /landings/:id/blocks` — actualiza `blocks_json` (working copy).
  - `POST /landings/:id/blocks/:blockId/move` — reorder.
  - `POST /landings/:id/blocks` — add block.
  - `DELETE /landings/:id/blocks/:blockId` — remove.
  - `POST /landings/:id/request-publish` — agente.
  - `POST /landings/:id/publish` — admin.
  - `POST /landings/:id/reject-publish` — admin.
  - `POST /landings/:id/archive`.
  - `POST /landings/:id/unarchive`.
  - `GET /landings/:id/versions` — listado.
  - `POST /landings/:id/rollback/:versionId`.
  - `GET /landings/:id/analytics?range=7d|30d`.
  - `GET /landing-templates` — catálogo filtrable por `kind`.
  - `POST /landing-templates` — admin.
  - `PATCH /landing-templates/:id` — admin.
- **api-ai** (autenticado):
  - `POST /landings/:id/edit-block` — body `{ blockId?, prompt, scope }` donde `scope ∈ { 'block', 'global' }`. `blockId` requerido si `scope='block'`.
- **api-public** (sin auth):
  - `GET /l/:fullSlug` — retorna la versión publicada. 404 si `status ≠ published`.
  - `POST /l/:fullSlug/submit` — crea lead.
  - `POST /l/:fullSlug/event` — registra analytics.

Workers prohibido: ejecutar SQL directo (`c.env.DB.prepare`), llamar `fetch()` a Groq/APIs externas, contener lógica de negocio.

## Modelo de datos (D1)

Se agregan 4 tablas. La tabla `leads` no se modifica.

### `landings`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | generado con `crypto` |
| `org_id` | TEXT FK | multi-tenant |
| `agent_id` | TEXT FK | owner |
| `template_id` | TEXT FK | origen (referencia) |
| `kind` | TEXT | `lead_capture` \| `property` |
| `slug_base` | TEXT | user-picked (kebab-case) |
| `slug_suffix` | TEXT(5) | random alfanumérico |
| `full_slug` | TEXT UNIQUE | generado; índice único global |
| `status` | TEXT | `draft` \| `pending_review` \| `published` \| `archived` |
| `blocks_json` | TEXT | working copy (editable) |
| `brand_voice` | TEXT | ~300 chars free-form |
| `lead_rules_json` | TEXT | `{ assigned_agent_id?, tags?, campaign?, notify_channels? }` |
| `seo_title` | TEXT | |
| `seo_description` | TEXT | |
| `og_image_url` | TEXT | |
| `published_version_id` | TEXT FK | a `landing_versions` |
| `published_at` | TEXT ISO | |
| `published_by` | TEXT | user_id del admin |
| `last_review_note` | TEXT nullable | nota del admin en rechazo (se muestra al agente) |
| `created_at` | TEXT ISO | |
| `updated_at` | TEXT ISO | |

**Invariante:** la pública se sirve desde `landing_versions[published_version_id].blocks_json`, **nunca** desde `blocks_json` de `landings` (así editar no afecta lo publicado).

### `landing_templates`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | |
| `org_id` | TEXT nullable | `null` = global disponible para todas las orgs |
| `name` | TEXT | |
| `kind` | TEXT | `lead_capture` \| `property` |
| `description` | TEXT | |
| `preview_image_url` | TEXT | R2 |
| `blocks_json` | TEXT | seed inicial de bloques |
| `active` | INTEGER | 0/1 |
| `sort_order` | INTEGER | para orden en UI |
| `created_at` / `updated_at` | TEXT ISO | |

Migration inicial seedea 3 templates globales: 2 de tipo `property` y 1 de `lead_capture`.

### `landing_versions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | |
| `landing_id` | TEXT FK | |
| `version_number` | INTEGER | monotónico por landing |
| `blocks_json` | TEXT | snapshot |
| `label` | TEXT | `auto-save` \| `ai-edit` \| `manual-save` \| `publish` |
| `created_by` | TEXT | user_id |
| `created_at` | TEXT ISO | |

**Política de snapshots:**
- Snapshot en cada `publish` (obligatorio).
- Snapshot en cada aceptación de edición IA (`ai-edit`).
- Auto-save `manual-save` con throttling de 30s en pausa de escritura.
- Retención: últimas 20 versiones por landing + todas las versiones con `label='publish'` son inmutables.

### `landing_events`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT PK | |
| `landing_id` | TEXT FK | |
| `slug` | TEXT | denormalizado para query |
| `event_type` | TEXT | `pageview` \| `cta_click` \| `form_start` \| `form_submit` |
| `visitor_id` | TEXT | cookie first-party |
| `session_id` | TEXT | se regenera a los 30min |
| `utm_source` | TEXT | |
| `utm_medium` | TEXT | |
| `utm_campaign` | TEXT | |
| `referrer` | TEXT | |
| `user_agent` | TEXT | |
| `created_at` | TEXT ISO | |

Índices: `(landing_id, created_at DESC)`, `(visitor_id)`, `(slug, event_type)`.

### Integración con `leads` (sin schema change)

El use-case `SubmitLeadFromLanding` aplica las `lead_rules_json` de la landing y llama al repo de `leads` existente:

- `source` = `'landing:<full_slug>'`
- `metadata_json` extiende con `{ landing_id, utm_source?, utm_medium?, utm_campaign?, referrer?, submitted_at }`
- Si hay `assigned_agent_id` en las rules, se respeta. Fallback: owner de la landing.
- Si hay `tags`, se agregan (extendiendo el array existente).
- Si hay `notify_channels`, se dispara email/WhatsApp al agente asignado.

## Sistema de bloques

### Envelope común

```ts
interface Block<T extends BlockType = BlockType> {
  id: string          // uuid, estable para click-to-edit y targeting de Groq
  type: T             // discriminator
  visible: boolean    // permite ocultar sin eliminar
  data: BlockData[T]  // shape específico por type
}
```

### Catálogo v1 (8 tipos)

| Type | Propósito | Campos clave |
|---|---|---|
| `hero` | Hero con imagen de fondo + overlay + CTA | `eyebrow?`, `title`, `subtitle?`, `cta?{label,href}`, `background_image_url`, `overlay_opacity` |
| `hero-split` | Texto a un lado, imagen/media al otro | `title`, `subtitle?`, `cta?`, `media_url`, `media_side: 'left'\|'right'`, `accent_color: 'pink'\|'orange'\|'dark'` |
| `features-grid` | Ventajas con ícono + título + texto | `title?`, `subtitle?`, `columns: 3\|4`, `items: Array<{icon, title, text}>` (3–8) |
| `amenities-chips` | Lista compacta de chips | `title?`, `chips: Array<{emoji?, label}>` (3–16) |
| `gallery` | Grilla de fotos | `layout: 'mosaic'\|'grid'\|'carousel'`, `images: Array<{url, alt?, source: 'upload'\|'external'\|'property', property_id?}>` (1–24) |
| `benefits-list` | Lista con checks | `title?`, `items: Array<{title, description?}>` (2–8) |
| `lead-form` | **Required** | `title`, `subtitle?`, `fields: Array<{key: 'name'\|'phone'\|'email'\|'address'\|'message', label, required}>` (`name` y `phone` siempre presentes), `submit_label`, `success_message`, `privacy_note?` |
| `footer` | Datos legales + contacto | `agency_name?`, `agency_registration?`, `phone?`, `email?`, `whatsapp?`, `instagram?`, `disclaimer?` |

### Validación

Todos los shapes se declaran con **Zod** en `core/src/domain/value-objects/block-schemas.ts`. Se usan en tres puntos:

1. `UpdateLandingBlocksUseCase` — valida antes de persistir el working copy.
2. `EditBlockWithAIUseCase` — valida el output de Groq antes de proponer al usuario.
3. `GetPublicLandingUseCase` — valida al leer (defense in depth; debería estar siempre ok si 1 y 2 funcionan).

### Renderer

Un solo componente `BlockRenderer` con registry `type → React.FC`. Se usa en editor (con overlay click-to-edit) y en la página pública (renderer puro).

```ts
const BLOCK_COMPONENTS: Record<BlockType, React.FC<{ data, mode: 'public' | 'editor' }>> = {
  hero: HeroBlock,
  'hero-split': HeroSplitBlock,
  // ...
}
```

## Editor (UX)

**Importante:** el editor se implementa con el mismo sistema de diseño que el resto de VendéPro (Tailwind, Poppins, fondo claro, colores `#ff007c` y `#ff8017`). **Sin dark mode.** Los mockups del brainstorming usaron dark solo por limitación del frame; la implementación real va en light.

### Layout 3 panes

- **Izquierda (220px):** lista ordenable de bloques con drag handle, indicador de `required` (lead-form), sección "Ocultos" separada, botón "Agregar bloque".
- **Centro:** preview live del working copy, toggle móvil/desktop en toolbar superior, botones deshacer/rehacer (actúan sobre versions).
- **Derecha (300px):** dos tabs.
  - **Inspector:** campos editables manualmente del bloque seleccionado + botón "Editar con IA este bloque".
  - **Chat IA:** scope toggle (solo bloque seleccionado / toda la landing), historial de la sesión, input, propuestas con Aceptar/Rechazar.

### Toolbar superior

- Nombre de la landing + subdominio proyectado (`<full_slug>.landings.vendepro.com.ar`).
- Botón "Versiones" → drawer con listado.
- Botón "Configuración" → drawer con slug, SEO, brand voice, lead rules, Turnstile toggle (fase 1.5).
- Botón "Vista previa" → abre `<full_slug>.landings.vendepro.com.ar` en pestaña nueva (solo si está publicada; si está en draft, preview interna en `/landings/:id/preview`).
- Botón "Solicitar publicación" (agente) o "Publicar" (admin).

### Flujo de edición IA

1. Usuario escribe prompt + elige scope + aprieta enviar.
2. Frontend hace `POST /landings/:id/edit-block` a `api-ai` con `{ blockId?, prompt, scope }`.
3. Backend arma prompt, llama Groq, valida con Zod, retry si falla, retorna `{ status, proposal }` o `{ status: 'error', reason }`.
4. Editor muestra diff en el panel de chat con botones Aceptar/Rechazar.
5. Aceptar → `PATCH /landings/:id/blocks` con los bloques modificados. Backend crea snapshot `ai-edit` y actualiza `blocks_json` del working copy.
6. Rechazar → descarta la propuesta, no persiste nada.

### Flujo de publish

1. Agente aprieta "Solicitar publicación" → `status = 'pending_review'`.
2. Email/notificación a admins del org con link a review.
3. Admin abre la landing, revisa, decide:
   - **Publicar** → crea snapshot `publish`, setea `published_version_id`, `published_at`, `published_by`, `status = 'published'`. La URL pública empieza a responder.
   - **Rechazar** → volver a `status = 'draft'` con nota (se guarda en `landings.last_review_note`).

### Listado de landings

- Ruta: `/landings` (nuevo item en sidebar, bajo "Calendario" y arriba de "Configuración").
- Tabs: `Mías` / `Todas del org` (admin) / `Pendientes aprobación` (admin).
- Tarjeta con thumbnail (screenshot del hero o preview image del template), nombre, slug, status chip, kind chip, KPI rápidos (submits 7d), menú acciones (editar, duplicar, archivar, ver pública, copiar URL).

### Creación

- Botón "Nueva landing" → modal con wizard de 2 pasos:
  1. Elegir template (grid de cards con preview + descripción, filtrable por `kind`).
  2. Nombrar + elegir `slug_base`. El sistema valida unicidad del `full_slug` y muestra el resultado final (`marcela-palermo-k7xm3`).
- Al confirmar → crea la landing (deep copy de `template.blocks_json` al working copy) y redirige al editor.

## Flujo de IA con Groq

### Modelo

`llama-3.3-70b-versatile` para ambos scopes. Soporta `response_format: 'json_object'` nativo, calidad decente en español rioplatense, Groq free tier alcanza para el volumen esperado.

### Prompts

**Scope = block:**

```
SYSTEM:
Sos copywriter de landings inmobiliarias para Argentina (español rioplatense).
Tu tarea es devolver SOLO un JSON válido con el `data` actualizado del bloque.
Reglas:
1. Mantené la estructura exacta del schema del bloque (no agregues ni quites campos).
2. NO cambies `id`, `type` ni `visible`. Solo podés cambiar los campos de `data`.
3. NO cambies URLs de imágenes ya existentes en el contenido.
4. Respondé en español rioplatense, tono: {brandVoice}.
5. Respondé SOLO el JSON, sin explicaciones, sin markdown.

USER:
Block schema: {zodSchemaAsJson}
Block actual: {currentBlockJson}
Pedido del usuario: {userPrompt}
```

**Scope = global:** el system prompt agrega "Devolvé un array `blocks` con la MISMA longitud, mismos `id` y `type` en el mismo orden. Solo modificá los `data` de los bloques relevantes al pedido."

### Pipeline

1. Editor llama `POST /landings/:id/edit-block` con `{ blockId?, prompt, scope }`.
2. Worker instancia `EditBlockWithAIUseCase(GroqAIService, LandingRepository)`.
3. Use-case lee landing, chequea permisos (agente debe ser owner o admin), arma contexto.
4. Llama `GroqAIService.editLandingBlock` o `editLandingGlobal`.
5. Adapter:
   - Llama Groq con `response_format: 'json_object'`.
   - Parsea JSON seguro (`safeParse`).
   - Valida con `BLOCK_SCHEMAS[type]` (scope=block) o cada bloque (scope=global).
   - Si falla Zod → retry **una sola vez** con mensaje correctivo incluyendo el error.
   - Si sigue fallando → retorna `{ status: 'error', reason: 'schema_mismatch' }`.
   - Si Groq devuelve 4xx/5xx → retorna `{ status: 'error', reason: 'provider_error' }`.
6. Use-case retorna la propuesta al editor (no persiste nada hasta que el usuario acepte).

### Guardrails

- Rate limit soft: máx 30 edits por user por minuto, enforced en use-case. La contabilidad se lleva en una tabla separada `ai_edit_log` (o equivalente KV rate-limit en CF) — no en `landing_events`, que queda solo para métricas de visitors del público.
- Input del usuario capped en 500 caracteres.
- Timeout a Groq: 15 segundos, luego abort + error al cliente.
- Todos los errores loggean en `wrangler tail` del worker pero no propagan stacks al cliente.

### Secret

`GROQ_API_KEY` se agrega como secret al worker `api-ai` via `wrangler secret put` (solo seteo de secret, no deploy). El secret ya existe para `api-ai` (`ANTHROPIC_API_KEY`); se suma otro.

## Publishing y routing

### Request flow

1. Visitor navega a `palermo-soho-k7xm3.landings.vendepro.com.ar`.
2. DNS: CNAME `*.landings` apunta a `vendepro-frontend.pages.dev` (proxied).
3. CF Pages recibe la request con cert wildcard automático.
4. Next.js `middleware.ts` detecta el host, extrae el slug con regex, hace `NextResponse.rewrite(new URL('/l/<slug>', req.url))`.
5. `app/l/[slug]/page.tsx` (Server Component) hace fetch a `api-public` con `next: { revalidate: 60 }`.
6. `api-public GET /l/:fullSlug` → `GetPublicLandingUseCase` → lee landing, busca `landing_versions[published_version_id].blocks_json`, retorna JSON con `{ blocks, seo, agency_brand, published_at }`.
7. Server Component renderiza `<BlockRenderer blocks={landing.blocks} mode="public" />`. `generateMetadata` usa `seo_title`, `seo_description`, `og_image_url`.

### Caching

- Next.js `revalidate: 60` (ISR).
- `api-public` setea `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600`.
- Submit y event endpoints: `Cache-Control: no-store`.
- **Purge automático en publish fuera de v1.** TTL máximo de 5 minutos es aceptable.

### Form submit

Cliente JS hace `POST` a `api-public.vendepro.com.ar/l/:fullSlug/submit` con los campos del form + UTM + visitor_id. CORS habilita origen `https://*.landings.vendepro.com.ar`. Respuesta incluye `success_message` para mostrar inline.

### Analytics tracking

Cliente JS dispara:
- `pageview` en mount.
- `cta_click` en click de CTAs.
- `form_start` en primer focus de un input del form.
- `form_submit` al confirmarse el submit (después del 201 de `/submit`).

Todos los events van a `POST /l/:fullSlug/event`. Visitor_id es cookie first-party SHA-256 (30 días). Session_id en sessionStorage.

## Analytics (tablero por landing)

Embebido en el detalle de la landing en `/landings/:id`:

- **KPIs** (cards): pageviews 7d, unique visitors 7d, form submits 7d, conversion rate (submits/pageviews).
- **Chart** (Recharts): pageviews últimos 14 días (bar chart).
- **Funnel**: pageviews → cta_clicks → form_start → form_submit (progress bars).
- **Top UTM sources**: top 10 por volumen, 7d.
- **Últimos submits**: 5 últimos leads con `source LIKE 'landing:<slug>%'` con link a `/leads/:id`.

Queries al vuelo contra `landing_events`. Sin tabla roll-up en v1. Se agrega `landing_event_rollup_daily` en fase 2 cuando el volumen supere ~500k events totales.

## Seguridad y permisos

### Autenticación

- Todas las rutas de `api-crm` y `api-ai` requieren `getCurrentUser()` (JWT).
- `api-public` no requiere auth pero valida origen via CORS.

### Autorización (en rules + use-cases)

| Acción | Agente | Admin |
|---|---|---|
| Listar landings propias | ✓ | ✓ |
| Listar todas del org | ✗ | ✓ |
| Crear landing | ✓ | ✓ |
| Editar landing propia (draft) | ✓ | ✓ |
| Editar landing ajena | ✗ | ✓ |
| Solicitar publicación | ✓ | ✓ |
| Publicar | ✗ | ✓ |
| Rechazar solicitud | ✗ | ✓ |
| Archivar | ✓ propia | ✓ todas |
| Rollback versión | ✓ propia en draft | ✓ todas |
| Crear/editar templates | ✗ | ✓ |

Multi-tenant: todas las queries filtran por `org_id`. El use-case valida que el `agent_id` de la landing pertenezca al `org_id` del current user.

### Protección del form público

- Rate limit soft: 5 submits por IP por minuto en `api-public`.
- Captcha Turnstile: **fase 1.5** (toggle opcional por landing).
- Sanitización de inputs: Zod valida tipos y longitudes.

## Infra Cloudflare (checklist manual)

**Ningún paso se ejecuta desde terminal.** Todo va por dashboard o GHA.

1. **DNS (CF Dashboard):** agregar registro CNAME `*.landings` apuntando a `vendepro-frontend.pages.dev`, status Proxied.
2. **Pages custom domain (CF Dashboard):** agregar `*.landings.vendepro.com.ar` al proyecto `vendepro-frontend`. Confirmar que el cert wildcard se emitió (puede tardar minutos).
3. **Secret de Groq:** el `GROQ_API_KEY` se carga como secret del worker `api-ai`. Alternativas válidas: (a) workflow de GHA que lee el secret desde GH Secrets y lo aplica con `wrangler secret put --env production`, o (b) carga manual desde CF Dashboard → Worker → Settings → Variables. **No se ejecuta `wrangler secret put` desde terminal local.**
4. **CORS en api-public:** actualizar la allowlist del middleware de CORS para incluir `https://*.landings.vendepro.com.ar`. Cambio en código, deploy por GHA.
5. **Migrations D1:** las 4 tablas nuevas van en `vendepro-backend/migrations_v2/` como nuevo archivo numerado. Se aplican por el workflow de GHA existente (o por dashboard de D1).
6. **Deploys:** frontend y workers por GHA (workflow por worker existente), o manual via CF Dashboard si fuera necesario. Nunca via `wrangler deploy` local.

## Testing

### Core (unit)

- Un test por use-case con mocks de ports (>90% cobertura).
- Tests de entidades, VOs, rules para casos de invariantes y transiciones.
- `block-schemas.ts` con casos válidos e inválidos por cada tipo de bloque.

### Infrastructure (integration)

- `D1Landing*Repository` tests contra D1 real via Miniflare (create, read, update, listar con filtros, contar events).
- `GroqAIService.editLandingBlock` con mock de `fetch` para happy path, schema mismatch + retry, 5xx + error.

### Workers (e2e)

- Happy path de cada endpoint nuevo en `api-crm`, `api-ai`, `api-public`.
- Tests de permisos (agente no puede publicar, admin sí; agente no puede editar landing ajena, etc.).
- Test del flow completo: crear → editar → request-publish → publish → GET público → submit → aparece lead.

### Frontend (smoke)

- Render de cada block component con datos válidos e inválidos (muestra fallback).
- Editor: click-to-edit selecciona el bloque correcto.
- Middleware: host con subdomain rewrite correctamente.

## Fases de implementación

Sugerencia para el plan. Cada fase es mergeable y parcialmente útil.

### Fase A — núcleo backend

Entidades, VOs, rules, ports, use-cases en `@vendepro/core` con tests unitarios. Adapters D1 + extensión de `GroqAIService` con tests de integración. Migrations de las 4 tablas. Seed de 3 templates globales. Rutas en `api-crm`, `api-ai`, `api-public`. Tests e2e de los workers.

Entregable: API completa. Sin UI.

### Fase B — editor

Block components (8) + `BlockRenderer`. Editor 3-panes con inspector, chat IA, toolbar, drawers de configuración y versions. Listado `/landings` con tabs y tarjetas. Wizard de creación. Flujo approval admin. Preview interna para drafts.

Entregable: agente y admin pueden crear, editar, solicitar publicación, publicar.

### Fase C — público + analytics

Infra CF (wildcard DNS, Pages custom domain, cert). `middleware.ts` con subdomain rewrite. Página pública `/l/[slug]` con SEO dinámico (`generateMetadata`). Form + tracking de events (cliente JS). Tablero de analytics en `/landings/:id`. Smoke tests end-to-end contra `*.landings.vendepro.com.ar`.

Entregable: landings publicadas son visitables, capturan leads, muestran analytics.

## Abierto / Fase 2+

Diseño y plan separados cuando se priorice:

- **Fase 2:**
  - Dominios custom del cliente (`landing_domains`, CF SaaS Custom Hostnames, verificación DNS).
  - Cache purge automático al publicar (CF cache purge API por URL).
  - A/B testing de bloques.
  - Captcha Turnstile con toggle por landing.
  - Schedule-publish (`scheduled_publish_at`).
  - `landing_event_rollup_daily` para volúmenes altos.
- **Fase 3+ (sin compromiso):**
  - Bloques extra (`testimonials`, `stats`, `map`, `faq`).
  - IA que modifica imágenes (generación o selección de stock).
  - Multi-idioma (EN, PT) con hreflang.
  - Export HTML estático.
  - Pixels externos (Meta, Google Ads).
  - Templates creados por end-users.
  - Colaboración multi-user con presence.
