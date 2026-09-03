# 🎨 Editor de landings — Frontend

Builder visual de landings: lista de bloques + inspector + preview + IA + versionado + publicación con review.

## Estructura de componentes

```
components/landings/
├── EditorToolbar.tsx           # toolbar superior (save, undo, preview, publish, AI)
├── BlockListSidebar.tsx        # lista de bloques (drag-drop)
├── BlockRenderer.tsx           # delega al renderer del tipo
├── InspectorPanel.tsx          # form del block seleccionado
├── ConfigDrawer.tsx            # drawer de metadata (SEO, brand voice, lead rules)
├── VersionsDrawer.tsx          # historial + rollback
├── PublishReviewBanner.tsx     # banner del flujo de pending_review
├── StatusBadge.tsx             # badge draft/pending_review/published/archived
├── LandingCard.tsx             # card del listado /landings
├── NewLandingModal.tsx         # modal de "crear desde template"
├── LandingMobileInfo.tsx       # info para mobile
├── ImageUpload.tsx             # uploader con R2
├── PropertyPhotoPicker.tsx     # picker de fotos de propiedad
│
├── blocks/                     # componentes de render público (12 tipos)
│   ├── HeroBlock.tsx
│   ├── HeroSplitBlock.tsx
│   ├── FeaturesGridBlock.tsx
│   ├── AmenitiesChipsBlock.tsx
│   ├── GalleryBlock.tsx
│   ├── BenefitsListBlock.tsx
│   ├── LeadFormBlock.tsx       # invariante: name + phone
│   ├── FooterBlock.tsx
│   ├── AgentHeroBlock.tsx      # perfil de agente — usa DS (Heading/Text/Card/Button)
│   ├── AgentCredentialsBlock.tsx
│   ├── FaqBlock.tsx
│   └── CtaWhatsappBlock.tsx    # usa WhatsAppButton de ui/ContactButtons
│
├── public/
│   ├── PublicLandingShell.tsx  # wrapper /l/[slug]
│   └── Tracker.tsx             # envía eventos pageview/cta_click/form_*/...
│
└── analytics/
    └── AnalyticsDashboard.tsx  # dashboard de eventos
```

> Corrección respecto de una versión anterior de este doc: no existe un subárbol `renderer/` aparte — `blocks/` es el único set de componentes de bloque, usados tanto por el editor (`mode="editor"`) como por la landing pública (`mode="public"`) vía `BlockRenderer.tsx` (nivel raíz de `components/landings/`).

## Bloques

Schemas Zod en backend (`domain/value-objects/block-schemas.ts`). 12 tipos:

| Tipo | Propósito |
|---|---|
| `hero` | hero full-width |
| `hero-split` | hero con imagen lateral |
| `features-grid` | grilla de features (3-4 cols) |
| `amenities-chips` | chips de amenities |
| `gallery` | galería de fotos |
| `benefits-list` | lista vertical de beneficios |
| `lead-form` | **invariante**: 1 y solo 1 en `lead_capture`/`property`; 0 o 1 en `agent_profile` — debe pedir name + phone |
| `footer` | footer custom |
| `agent-hero` | foto, headline, bio y hasta 3 CTAs del agente |
| `agent-credentials` | matrícula, años de experiencia, zonas, especialidades, stats |
| `faq` | 2 a 12 preguntas/respuestas |
| `cta-whatsapp` | CTA de WhatsApp con `message_template` |

Los últimos 4 son de [[Dominio-Landings]] § Perfil de agente (Feature 07). Un bloque puede llevar `binding: 'agent_profile'` (hoy: `agent-hero`, `agent-credentials`, `cta-whatsapp`, `footer`) — en ese caso sus campos bindeados salen **read-only** en `InspectorPanel`, reemplazados por un aviso ("Se sincroniza con tu perfil público. Editalo en Perfil.") con link a `/perfil`. El editor solo muestra/propone; quien resuelve el binding con datos reales es `resolveAgentBindings` en la lectura pública (nunca en el editor ni en la IA de edición).

`InspectorPanel.tsx` suma 3 editores de campos para estos tipos (`AgentHeroFields`, `AgentCredentialsFields`, `CtaWhatsappFields`, funciones internas del mismo archivo) — mismo patrón que los editores preexistentes. `InspectorPanel.tsx` (junto con `ImageUpload.tsx` y `AIChatPanel.tsx`) es una **excepción explícita** a la regla 9 del design system (`doc/ds-visual-rules.md:161-168`): panel denso de ~340px donde `Input`/`Field` del DS de densidad estándar rompen el layout, así que usa una abstracción local (`inputClass`/inputs a mano) consistente entre todos sus campos. La excepción **no** cubre `PerfilPublicoForm.tsx` — es formulario de página completa, y sí usa `Input`/`Field` del DS.

## Flujo del editor

```
Agente abre /landings/[id]
   ↓
Editor carga landing + blocks
   ↓
Cambios → useAutosave (throttle 30s, label="auto-save") → POST /landings/:id/blocks
   ↓
Save manual → guarda con label "manual-save"
   ↓
AI edit:
   - Selecciona block → escribe prompt
   - POST /landings/:id/edit-block ([[API-ai]])
   - Groq llama-3.3-70b valida contra schema Zod
   - Si OK → versión con label "ai-edit"
   - Si schema_mismatch → toast de error
   - Rate limit: 30 ediciones/min (AI_EDITS_PER_MINUTE)
   ↓
Publish:
   - Agente: POST /landings/:id/request-publish → pending_review
   - Admin: POST /landings/:id/publish → published (label "publish")
   - Admin: POST /landings/:id/reject-publish → vuelve a draft con review_note
   ↓
Rollback:
   - Drawer de versiones (sólo si draft|pending_review)
   - POST /landings/:id/rollback/:versionId
```

## SEO + metadata

ConfigDrawer permite editar:
- `seo_title`, `seo_description`, `og_image_url`
- `slug_base` (no se puede cambiar el `slug_suffix`)
- `brand_voice` (string libre, usado por IA)
- `lead_rules`: `{assigned_agent_id, tags, campaign, notify_channels}`

## URL pública

- `/l/<full_slug>` (en frontend)
- Subdomain: `<full_slug>.landings.vendepro.com.ar` (Next middleware reescribe)
- `agent_profile` tiene además su propia familia de URL: `/a/<orgSlug>/<agentSlug>` (no pasa por `full_slug`). Ver [[Dominio-Landings]] § Perfil de agente y [[Frontend-rutas]].

## Analytics

`Tracker.tsx` envía a `POST /l/:slug/event` ([[API-public]]):
- `pageview` al cargar
- `cta_click` en CTAs
- `form_start` al focar primer field
- `form_submit` al enviar (combinado con `SubmitLeadFromLandingUseCase` que dispara marketing event)

`AnalyticsDashboard.tsx` consume `GET /landings/:id/analytics?rangeDays=7|14|30`.

## Relacionados

- [[Dominio-Landings]]
- [[Dominio-Usuarios-Org]] (`agent_profiles`, perfil público en `/perfil`)
- [[API-crm]] (CRUD + versions + publish)
- [[API-ai]] (edit-block)
- [[API-public]] (público + submit + event + `/a/:orgSlug/:agentSlug`)
- [[API-admin]] (`/profile/public`)
- [[Frontend-editor-tasaciones]] (comparten algunos renderers)
