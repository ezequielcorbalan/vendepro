# 📐 Editor de tasaciones — Frontend

Sistema de **bloques + templates + variables** para crear tasaciones. Vive en `components/tasaciones/`.

## Concepto

```
AppraisalTemplate (definido por la org o sistema)
   │
   │ blocks[] — definición + binding mode por block
   │
   ▼
Appraisal (instancia para una propiedad concreta)
   │  template_id + template_snapshot_json (snapshot al momento de crear)
   │  block_overrides_json (overrides puntuales por block)
   │  + datos propios (property_address, comparables, prices, SWOT, etc.)
   │
   ▼
HydrateTemplateBlocks() use case →
   resuelve cada block según binding mode:
     - system        → hard-coded en el código
     - org-static    → leído de `organizations` (logo, brand, etc.)
     - org-variable  → leído de `org_variables` (market, notary, etc.)
     - tasacion      → leído de la appraisal misma
     - default-override → override del template + ajuste de tasacion
   │
   ▼
Renderer (TemplateRenderer + BlockRenderer)
```

## Tipos de bloque

Ver `domain/value-objects/appraisal-block-type.ts`:

**Estructurales** (mismo en toda tasación):
- `cover` — portada
- `proposal_commercial` — propuesta comercial
- `services_grid` — grilla de servicios
- `market_stats` — estadísticas de mercado
- `funnel_chart` — embudo de captación → cierre
- `methodology` — metodología
- `notary_charts` — gastos notariales

**Dinámicos** (datos específicos de la tasación):
- `property_data`
- `swot` (FODA)
- `zone_map`
- `comparables_list`
- `price_projection`
- `work_conditions`

**Web-only** (no van al PDF):
- `video_gallery`
- `extra_media`
- `cta_whatsapp`
- `agent_contact_card`

## Estructura de componentes

```
components/tasaciones/
├── editor/
│   ├── BlockForm.tsx           # form genérico que delega a block-forms/{tipo}.tsx
│   ├── BlockList.tsx           # lista lateral de bloques (drag-drop)
│   ├── SyncBanner.tsx          # banner si el template tiene cambios desde el snapshot
│   ├── useAutosave.ts          # hook (throttle 30s)
│   ├── useEditorState.ts       # estado central
│   └── block-forms/            # 14 forms específicos (uno por tipo de block)
│
├── renderer/
│   ├── BlockRenderer.tsx       # delega al renderer del tipo
│   ├── TemplateRenderer.tsx    # renderiza la tasación completa
│   ├── block-utils.ts          # utils compartidos
│   ├── hydrate-blocks.ts       # cliente-side de la hidratación (espejo del backend)
│   ├── types.ts                # tipos de los blocks
│   └── blocks/                 # 18 renderers (incluye `unknown` para fallback)
│
├── admin/                      # gestión de templates de la org
│   ├── BlockAdminForm.tsx
│   ├── OrgConfigForm.tsx
│   ├── TemplateEditor.tsx
│   ├── TemplatesHome.tsx
│   ├── VariableModal.tsx
│   ├── VariablesHome.tsx
│   └── MOCK_APPRAISAL.ts
│
├── legacy/
│   └── PublicAppraisalShell.tsx
└── shared/
    └── api.ts
```

## Frontend pages relevantes

- `/tasaciones/[id]/editar` — usa el editor completo
- `/tasaciones/[id]` — preview con renderer
- `/t/[slug]` (público) — tasación pública renderizada
- `/configuracion/tasacion` — admin: lista templates + variables
- `/configuracion/tasacion/templates/[id]` — admin: editar template
- `/perfil/tasaciones`

## Use cases relevantes (backend)

- `HydrateTemplateBlocks` (fusión de fuentes)
- `SetBlockOverrides` (PATCH per-block)
- `SyncTemplateSnapshot` (refrescar snapshot)
- `GenerateAppraisalPdf` (usa CF Browser Rendering apuntando a `/t/[slug]`)

## Memoria operativa

- **Desktop-first para creación** (mucha info en pantalla)
- **Mobile-first para tasación pública** (el cliente la abre en el celular)

Esta es la única feature que invierte la regla de [[Reglas-criticas|Reglas críticas]] (en general mobile-first es para field work).

## Org Variables

Ver [[Dominio-Usuarios-Org]]:
- `market.*` (datos de mercado actuales: # propiedades en venta, días promedio, etc.)
- `notary.*` (costos escrituración, sellados, etc.)
- `custom.*` (libre)

Cada org tiene su propio set. Los blocks con binding `org-variable` los leen en la hidratación.

## Relacionados

- [[Dominio-Tasaciones]]
- [[API-properties]] (CRUD)
- [[API-admin]] (templates + variables)
- [[Servicios-externos]] (CF Browser Rendering para PDF)
