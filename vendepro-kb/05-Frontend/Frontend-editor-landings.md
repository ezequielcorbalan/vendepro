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
├── blocks/                     # editores específicos (8 tipos)
│   ├── HeroBlock.tsx
│   ├── HeroSplitBlock.tsx
│   ├── FeaturesGridBlock.tsx
│   ├── AmenitiesChipsBlock.tsx
│   ├── GalleryBlock.tsx
│   ├── BenefitsListBlock.tsx
│   ├── LeadFormBlock.tsx       # invariante: name + phone
│   └── FooterBlock.tsx
│
├── renderer/                   # renderer para landings públicas + previews
│   ├── BlockRenderer.tsx
│   ├── TemplateRenderer.tsx
│   ├── blocks/*.tsx            # 25+ renderers (incluye los de tasaciones)
│   └── __tests__/blocks-smoke.test.tsx
│
├── public/
│   ├── PublicLandingShell.tsx  # wrapper /l/[slug]
│   └── Tracker.tsx             # envía eventos pageview/cta_click/form_*/...
│
└── analytics/
    └── AnalyticsDashboard.tsx  # dashboard de eventos
```

## Bloques

Schemas Zod en backend (`domain/value-objects/block-schemas.ts`). 8 tipos:

| Tipo | Propósito |
|---|---|
| `hero` | hero full-width |
| `hero-split` | hero con imagen lateral |
| `features-grid` | grilla de features (3-4 cols) |
| `amenities-chips` | chips de amenities |
| `gallery` | galería de fotos |
| `benefits-list` | lista vertical de beneficios |
| `lead-form` | **invariante**: debe haber 1 y solo 1 por landing, debe pedir name + phone |
| `footer` | footer custom |

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

## Analytics

`Tracker.tsx` envía a `POST /l/:slug/event` ([[API-public]]):
- `pageview` al cargar
- `cta_click` en CTAs
- `form_start` al focar primer field
- `form_submit` al enviar (combinado con `SubmitLeadFromLandingUseCase` que dispara marketing event)

`AnalyticsDashboard.tsx` consume `GET /landings/:id/analytics?rangeDays=7|14|30`.

## Relacionados

- [[Dominio-Landings]]
- [[API-crm]] (CRUD + versions + publish)
- [[API-ai]] (edit-block)
- [[API-public]] (público + submit + event)
- [[Frontend-editor-tasaciones]] (comparten algunos renderers)
