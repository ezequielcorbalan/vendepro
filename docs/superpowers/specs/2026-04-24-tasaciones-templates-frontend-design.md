# Tasaciones Templates — Frontend (Sub-plan 2)

**Fecha:** 2026-04-24
**Autor:** Ezequiel Corbalán + Claude
**Estado:** Diseño aprobado, pendiente de plan de implementación
**Continuación de:** `docs/superpowers/specs/2026-04-23-tasaciones-templates-design.md` (spec global) y `docs/superpowers/plans/2026-04-23-tasaciones-templates-backend.md` (Sub-plan 1 — backend foundation, mergeado a `main` el 2026-04-24).

---

## 1. Alcance y objetivo

El backend (Sub-plan 1) ya está en producción: tablas `appraisal_templates`, `org_variables`, `appraisal_pdfs`, extensión de `appraisals`, 4 templates sistema sembrados, use cases y rutas API completas.

Este sub-plan construye el **frontend completo** que consume ese backend:

1. **Wizard** de nueva tasación (`/tasaciones/nueva`) con selección de template.
2. **Editor** de tasación (`/tasaciones/[id]/editar`) con split panel + preview in-place.
3. **Renderer público** de tasación (`/t/[slug]`) con switch legacy/nuevo por runtime.
4. **Admin** completo (`/configuracion/tasacion/**`): templates list + editor + variables + config general.

**Fuera de alcance (Sub-plan 3):**
- Generación de PDF vía Cloudflare Browser Rendering.
- `MigrateLegacyAppraisalUseCase` (migración de tasaciones con JSON legacy al modelo nuevo).
- Cron de cleanup de `appraisal_pdfs` expirados.

---

## 2. Decisiones clave (diff vs spec global)

| Decisión | Elegido | Razón / diff |
|---|---|---|
| Scope de esta fase | Todo el frontend del feature (wizard + editor + renderer + admin completo) | Feature completo para permitir validación real con Marcela; PDF y migración van aparte |
| Orden de entrega | Wizard + renderer público en paralelo → editor → admin | Cierra el loop agente→cliente primero |
| Legacy compat | Runtime switch en `/t/[slug]`: si `template_id` → nuevo renderer, si no → `PublicAppraisalShell` intacto | Evita compat layer complejo, migración irreversible aparte |
| Wizard/editor legacy | Reemplazar y borrar steps legacy en el mismo commit | Sin feature flag; tasaciones legacy quedan read-only hasta migración |
| Preview live del editor | In-place (`<TemplateRenderer/>` directo en el panel derecho) + botón "Ver pública ↗" que abre `/t/[slug]` en otra pestaña | **Cambio vs spec global §6.2** (que proponía iframe): instantáneo al tipear, sin roundtrip, sin autosave-before-refresh |
| Responsive priority | Creación (wizard/editor/admin) desktop-first; landing pública mobile-first | Agente crea en oficina, cliente final ve en celular |
| Arquitectura del código | Monolito por feature bajo `components/tasaciones/` con subcarpetas por responsabilidad (renderer/ wizard/ editor/ admin/ legacy/ shared/) | Mismo patrón que `landings/` del repo |
| Drag-drop bloques en admin | `@dnd-kit/sortable` | Liviano, accesible, mantiene estado simple |
| Print CSS | Dual path: `@media print` + selectores `[data-force-print="true"]` | Sub-plan 3 (PDF) usará el atributo sin imprimir realmente |
| Tipos TS (`TemplateBlock`, `BindingMode`, etc.) | Copiados a `renderer/types.ts`, **no** importados del backend | Frontend y backend son paquetes separados; sincronización manual documentada |
| Config firma/disclaimer (admin General) | Se guardan como variables `custom.*` (no columnas nuevas) | Evita migración extra; el admin las trata como cualquier variable |

---

## 3. Arquitectura del código

### 3.1 Árbol de archivos

```
src/components/tasaciones/
├── renderer/
│   ├── TemplateRenderer.tsx      # recibe { snapshot, overrides, appraisal, resolvedVars, mode } → hidrata y mapea a BlockRenderer
│   ├── BlockRenderer.tsx         # switch por block.type, agrega data-* attrs
│   ├── hydrate-blocks.ts         # port client-side del HydrateTemplateBlocksUseCase del backend
│   ├── block-utils.ts            # PAGE_BREAK_BEFORE set, classnames helpers
│   ├── types.ts                  # TemplateBlock, BindingMode, AppraisalBlockType, AppraisalContext, ResolvedVars, BlockOverrides
│   ├── print.css                 # dual path print
│   └── blocks/                   # 17 componentes (16 tipos + UnknownBlock fallback)
│       ├── CoverBlock.tsx, ProposalCommercialBlock.tsx, ServicesGridBlock.tsx,
│       │   MarketStatsBlock.tsx, FunnelChartBlock.tsx, MethodologyBlock.tsx,
│       │   NotaryChartsBlock.tsx, PropertyDataBlock.tsx, SwotBlock.tsx,
│       │   ZoneMapBlock.tsx, ComparablesListBlock.tsx, PriceProjectionBlock.tsx,
│       │   WorkConditionsBlock.tsx, VideoGalleryBlock.tsx, ExtraMediaBlock.tsx,
│       │   CtaWhatsappBlock.tsx, AgentContactCardBlock.tsx, UnknownBlock.tsx
├── wizard/
│   ├── WizardShell.tsx
│   ├── use-wizard-form.ts
│   └── steps/
│       ├── StepTemplate.tsx, StepProperty.tsx, StepDetails.tsx, StepReview.tsx
├── editor/
│   ├── EditorShell.tsx           # split 50/50, usa <TemplateRenderer/> in-place
│   ├── BlockList.tsx
│   ├── BlockForm.tsx             # switch por type → form específico; edita overrides
│   ├── SyncBanner.tsx
│   ├── useAutosave.ts            # debounced PUT + estado (idle/debouncing/saving/saved/error)
│   ├── useEditorState.ts         # useReducer con appraisal + overrides + dirty flag
│   └── block-forms/              # un form por tipo editable; el renderizado read-only vs editable lo decide binding_mode en runtime
├── admin/
│   ├── TemplatesHome.tsx         # grid + actions (duplicar/archivar/crear)
│   ├── TemplateEditor.tsx        # reusa <EditorShell mode="template"/>
│   ├── BlockAdminForm.tsx        # extiende BlockForm con binding_mode dropdown + include_in_pdf toggle
│   ├── VariablesHome.tsx
│   ├── VariableModal.tsx
│   ├── OrgConfigForm.tsx         # firma + disclaimer (escribe custom.*)
│   └── MOCK_APPRAISAL.ts         # contexto dummy para el preview del admin template editor
├── legacy/
│   └── PublicAppraisalShell.tsx  # MOVIDO desde components/tasaciones/; intacto
└── shared/
    ├── api.ts                    # wrappers tipados sobre apiFetch (getAppraisal, listTemplates, etc.)
    └── formatters.ts             # currency, percent, dates (Argentina locale)
```

### 3.2 Páginas (Next.js `app/`)

| Ruta | Nuevo / Reescrito | Consume |
|---|---|---|
| `app/(dashboard)/tasaciones/nueva/page.tsx` | Reescrito (eran 375 líneas) | `<WizardShell/>` |
| `app/(dashboard)/tasaciones/[id]/editar/page.tsx` | Reescrito (eran 845 líneas) | `<EditorShell/>` |
| `app/(dashboard)/configuracion/tasacion/page.tsx` | Reescrito | Hub con 3 tabs |
| `app/(dashboard)/configuracion/tasacion/templates/[id]/page.tsx` | Nuevo | `<TemplateEditor/>` |
| `app/t/[slug]/page.tsx` | Modificado (runtime switch) | `<TemplateRenderer/>` o `<PublicAppraisalShell/>` |

### 3.3 Archivos borrados en este sub-plan

- `src/components/tasaciones/steps/ProposalStep.tsx`
- `src/components/tasaciones/steps/MarketSituationStep.tsx`
- `src/components/tasaciones/steps/WorkConditionsStep.tsx`
- `src/components/tasaciones/PreviewPane.tsx`
- `src/components/tasaciones/wizardTypes.ts`

`PublicAppraisalShell.tsx` NO se borra — se **mueve** a `legacy/` y sigue sirviendo a tasaciones sin `template_id`.

---

## 4. Renderer (pieza central, reusada 4 veces)

### 4.1 Tipos compartidos (`renderer/types.ts`)

Copiados textualmente del backend. Incluir comentario al tope: `// TIPOS SINCRONIZADOS MANUALMENTE con vendepro-backend/packages/core/src/domain. Si cambia el backend, actualizar acá.`

```typescript
export type BindingMode = 'system' | 'org-static' | 'org-variable' | 'tasacion' | 'default-override'

export type AppraisalBlockType =
  | 'cover' | 'proposal_commercial' | 'services_grid' | 'market_stats' | 'funnel_chart'
  | 'methodology' | 'notary_charts' | 'property_data' | 'swot' | 'zone_map'
  | 'comparables_list' | 'price_projection' | 'work_conditions'
  | 'video_gallery' | 'extra_media' | 'cta_whatsapp' | 'agent_contact_card'

export interface TemplateBlock {
  id: string
  type: AppraisalBlockType
  binding_mode: BindingMode
  include_in_pdf: boolean
  sort_order: number
  data: Record<string, unknown>
}

export interface AppraisalContext {
  property_address: string
  neighborhood: string | null
  city: string | null
  property_type: string | null
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  weighted_area: number | null
  swot: { strengths: string | null; weaknesses: string | null; opportunities: string | null; threats: string | null } | null
  prices: { suggested: number | null; test: number | null; expected_close: number | null; usd_per_m2: number | null } | null
  comparables: AppraisalComparable[]
  agent: { name: string; phone: string | null; email: string | null; avatar_url: string | null } | null
  org: { name: string; logo_url: string | null; brand_color: string | null; brand_accent_color: string | null } | null
}

export type ResolvedVars = Record<string, { value: string; type: string }>
export type BlockOverrides = Record<string, Record<string, unknown>>

export interface HydratedBlock extends TemplateBlock {
  resolved_data: Record<string, unknown>
}
```

### 4.2 `hydrate-blocks.ts` (función pura, port del backend)

```typescript
export function hydrateBlocks(input: {
  snapshot: TemplateBlock[]
  overrides: BlockOverrides
  appraisal: AppraisalContext
  resolvedVars: ResolvedVars
  mode: 'web' | 'print'
}): HydratedBlock[]
```

**Pipeline:**

1. Filtrar por `mode` (print excluye `include_in_pdf === false`).
2. Ordenar por `sort_order` asc.
3. Por cada bloque:
   a. Base = `block.data`.
   b. Si hay refs a variables (`data.vars`, `data.chart_1_var`, `data.chart_2_var`) → `resolved_data.vars_resolved = { key: { value, type } }`.
   c. Si `data.source`:
      - `'appraisal.*'` → merge property fields.
      - `'appraisal.swot'` → merge SWOT.
      - `'appraisal.prices'` → merge prices.
      - `'appraisal.comparables'` → `resolved_data.comparables = appraisal.comparables` (filtrado por variant si aplica).
   d. Si `overrides[block.id]` → shallow-merge encima.

**Contrato:** idéntico al `HydrateTemplateBlocksUseCase` de backend. Tests cliente y servidor con mismos inputs deben dar mismos outputs.

### 4.3 `<TemplateRenderer/>` y `<BlockRenderer/>`

`<TemplateRenderer/>` usa `useMemo` para hidratar; mapea al `<BlockRenderer/>` que es un switch por tipo. Cada componente de bloque agrega data attrs:

- `data-block={type}`
- `data-block-id={block.id}`
- `data-block-web-only="true"` si `include_in_pdf === false`
- `data-block-page-break="true"` si está en `PAGE_BREAK_BEFORE = { 'proposal_commercial', 'property_data', 'comparables_list', 'price_projection', 'work_conditions' }`

### 4.4 Print CSS (`renderer/print.css`)

Dual path para que Sub-plan 3 pueda disparar print sin `window.print()`:

```css
@media print {
  [data-block-web-only="true"] { display: none !important; }
  [data-block] { page-break-inside: avoid; break-inside: avoid; }
  [data-block-page-break="true"] { page-break-before: always; break-before: page; }
  .no-print, nav, header[role="banner"] { display: none !important; }
  body { font-size: 10pt; }
}

[data-force-print="true"] [data-block-web-only="true"] { display: none !important; }
[data-force-print="true"] [data-block] { page-break-inside: avoid; break-inside: avoid; }
[data-force-print="true"] [data-block-page-break="true"] { break-before: page; }
[data-force-print="true"] .no-print { display: none !important; }

@page { size: A4; margin: 12mm; }
```

### 4.5 Estilo de los 17 componentes de bloque

Todos mobile-first (Tailwind breakpoints `md:` y `lg:`). Usan el brand color de la org vía CSS variable `--brand-color` seteada en el wrapper `<TemplateRenderer/>`. Tipografía Poppins (ya configurada en el layout).

**Contrato común:**

```typescript
interface BlockProps<D> {
  data: D         // resolved_data tipado según el tipo
  mode?: Mode     // 'web' | 'print', opcional; default 'web'
  // props extra según el bloque (appraisal.agent, appraisal.org, etc.)
}
```

---

## 5. Wizard (`/tasaciones/nueva`)

### 5.1 Estado

`useReducer` con shape:

```typescript
type WizardState = {
  step: 1 | 2 | 3 | 4
  template_id: string | null
  property: { address: string; neighborhood?: string; city?: string; property_type?: string; covered_area?: number; total_area?: number; semi_area?: number; weighted_area?: number }
  lead_id: string | null
  details: { strengths?: string; weaknesses?: string; opportunities?: string; threats?: string; suggested_price?: number; test_price?: number; expected_close_price?: number; usd_per_m2?: number }
  comparables: AppraisalComparable[]   // in-memory; se persisten en el publish
  publish: { generate_public_slug: boolean }
}
```

### 5.2 Pasos

1. **StepTemplate** — `GET /appraisal-templates?active=1` + card "Empezar de cero". Grid `grid-cols-1 md:grid-cols-3`. Click → selecciona; doble-click o botón "Siguiente" avanza.
2. **StepProperty** — form desktop-first (grid 2 cols), reusa `<PropertySelector/>` para lead. Validación cliente: address required, superficies > 0 si presentes.
3. **StepDetails** — 3 grupos colapsables (SWOT textareas / Precios inputs / Comparables lista con modal add). Comparables en memoria hasta paso 4.
4. **StepReview** — `<TemplateRenderer/>` full-width con `AppraisalContext` construido del state. Toggle "Generar link público" + botones `Guardar borrador` / `Publicar`.

### 5.3 Publish flow

1. `POST /appraisals` con `{ template_id, property.*, lead_id, details.*, agent_id }` → `{ id, status: 'draft' }`.
2. Si `generate_public_slug` → `POST /appraisals/publish?id={id}` → `{ public_slug }`.
3. Comparables: por cada uno `POST /appraisals/comparables`.
4. Redirect `/tasaciones/[id]/editar?welcome=1`.

### 5.4 Query param shortcut

`/tasaciones/nueva?template=X` preselecciona el template y arranca en paso 2. Útil para CTAs desde otras pantallas (ej. botón "Tasar esta propiedad" en `/propiedades/[id]`).

### 5.5 Mobile (funcional, no prioridad)

Steps stack vertical; nav sticky al bottom con `safe-area-inset-bottom`.

---

## 6. Editor (`/tasaciones/[id]/editar`)

### 6.1 Layout desktop

Header con `[← Volver]` + `[Ver pública ↗]` (link `_blank` a `/t/{public_slug}`, disabled si no hay slug) + autosave status + `[Publicar]` (si todavía no publicó).

Split 50/50: panel izq sticky con scroll independiente, preview der con scroll independiente.

### 6.2 Panel izquierdo

Dos grupos:

**A) Datos fijos del appraisal** (siempre presente):
- Datos propiedad (address, neighborhood, city, property_type, superficies).
- FODA (4 textareas).
- Precios (3 number inputs + USD/m²).
- Comparables (lista editable).

Cambios → `PUT /appraisals?id=X` con `{ campo: valor }`.

**B) Bloques del template** (dinámico según snapshot):
- Cada bloque es una row expandible.
- `binding_mode` determina editabilidad:
  - `system`, `org-static`, `org-variable` → read-only (icono 🔒). Admin ve link "Editar en configuración".
  - `tasacion`, `default-override` → editable con `<BlockForm/>` específico por tipo.

Cambios → `PATCH /appraisals/:id/blocks/:block_id` con `{ campo: valor }`.

### 6.3 Preview in-place

`<TemplateRenderer/>` consume state local directo. `useMemo` evita rehidratar en keystrokes consecutivos. Toggle `[Web / Print]` arriba del preview (solo afecta la vista, no altera datos).

### 6.4 Autosave (`useAutosave`)

- Debounce 2 segundos desde última modificación.
- Dos endpoints según el tipo de cambio (ver 6.2).
- Estado: `idle | debouncing | saving | saved | error`.
- Indicador en header: `✓ Guardado · hace 2s` / `Guardando...` / `⚠ Error al guardar [Reintentar]`.
- `beforeunload` guard si `dirty === true`.

### 6.5 Sync banner

En load: `GET /appraisal-templates/{template_id}` y comparar `template.updated_at` vs `appraisal.template_synced_at`.

Si hay diferencia: banner sticky amarillo arriba del split: "El template *{name}* fue actualizado el {fecha}. [Actualizar mi tasación]".

Click → `POST /appraisals/:id/sync-template` → backend preserva overrides → refetch del appraisal.

### 6.6 Mobile

Panel full-width (acordeón colapsable). Botón flotante bottom-right `👁 Preview` → bottom sheet con `<TemplateRenderer/>`.

---

## 7. Renderer público (`/t/[slug]`)

Modificar `app/t/[slug]/page.tsx` con runtime switch:

```typescript
const data = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' }).then(r => r.json())
if (!data?.appraisal) notFound()

const isPrint = (await searchParams)?.print === '1'
const hasTemplate = !!data.appraisal.template_id && !!data.appraisal.template_snapshot_json

if (hasTemplate) {
  return (
    <>
      <TemplateRenderer
        snapshot={parseSnapshot(data.appraisal.template_snapshot_json)}
        overrides={parseOverrides(data.appraisal.block_overrides_json)}
        appraisal={buildAppraisalContext(data)}
        resolvedVars={data.resolved_vars ?? {}}
        mode={isPrint ? 'print' : 'web'}
      />
      <GtmScript />
    </>
  )
}
return <PublicAppraisalShell data={data} />   // legacy path
```

**Gap a verificar al arrancar implementación:** `GET /public/appraisal/:slug` debe devolver `resolved_vars` ya computado. Si no lo hace, agregar esa resolución al endpoint público en `api-public` (primera task del plan).

`/t/[slug]` sigue siendo Server Component con `generateMetadata` dinámico (título = property_address, robots noindex).

---

## 8. Admin (`/configuracion/tasacion/`)

### 8.1 Hub

`/configuracion/tasacion/page.tsx` con tabs. Query param `?tab=templates|variables|general` para deep-linking. Tab default: `templates`.

### 8.2 Templates

**List (`TemplatesHome`):**
- `GET /appraisal-templates`.
- Grid de cards: preview_image + name + kind badge + is_system badge + active toggle + menu [Editar / Duplicar / Archivar].
- System templates: solo `Duplicar` disponible.
- `+ Crear template` → modal (name + kind) → `POST /appraisal-templates` con `blocks: []` → redirect.

**Editor (`TemplateEditor`):** reusa `<EditorShell mode="template"/>` con comportamiento modificado:
- Sidebar sin "datos propiedad" (ese concepto es del appraisal).
- Cada bloque: `binding_mode` dropdown + `include_in_pdf` toggle (disabled en PDF_LOCKED_TYPES) + `data` form + botón eliminar.
- `+ Agregar bloque` → modal con dropdown de tipo.
- Drag-drop reorder con `@dnd-kit/sortable` → actualiza `sort_order` → persiste.
- Preview con `MOCK_APPRAISAL` (tasación dummy de Casa con datos razonables).
- Autosave: debounce 2s → `PUT /appraisal-templates/:id` con `{ blocks: [...] }` completo.
- Warning banner: "Cambios afectan tasaciones nuevas. Las existentes ven banner con opción de actualizar."
- System template → modo lectura + CTA `Duplicar para editar`.

### 8.3 Variables (`VariablesHome`)

- `GET /org-variables` agrupado client-side por namespace (`market` / `notary` / `custom`).
- 3 secciones expandibles. Cada fila: key (readonly) + label + value_type + input apropiado + botón `Guardar`.
- **No autosave** (edición deliberada).
- Sección custom: `+ Nueva variable` → `<VariableModal/>`:
  - key con prefix forzado `custom.` (validación `/^custom\.[a-z_][a-z0-9_]*$/`).
  - label string.
  - value_type dropdown (number / percent / text / date / image_url).
  - valor inicial.
  - `POST /org-variables`.
- Custom variables con botón `🗑` → `DELETE /org-variables/:id` (backend rechaza si `is_system=1`).

**Image upload para `image_url`:** reusa `<ImageUpload/>` de `components/landings/` si es compatible. Endpoint confirmable al implementar (si no existe `/upload-image`, agregarlo al plan).

### 8.4 General (`OrgConfigForm`)

Form simple: firma del titular (image upload) + disclaimer legal (textarea).

**Implementación:** ambas son variables custom de sistema:
- `custom.org_signature_url` (value_type `image_url`, is_system=1).
- `custom.org_disclaimer_legal` (value_type `text`, is_system=1).

**Seed de estas 2 variables por org:** se crean on-demand la primera vez que un admin abre la tab "General" — el frontend detecta que no existen y hace `POST /org-variables` con valores iniciales vacíos. Evita una migración SQL nueva y cubre orgs futuras sin esfuerzo manual. Alternativa descartada: sembrar en migración — requiere scripting dinámico por cada org y no ofrece valor si nadie las usa.

Guardar → `PUT /org-variables/:id`. Los bloques que necesiten (`work_conditions`, `agent_contact_card`) las referencian por key.

### 8.5 Permisos

`/configuracion/tasacion/**` → admin-only (middleware existente + check en server component).

---

## 9. Estados transversales

### 9.1 Loading / Empty / Error

| Pantalla | Loading | Empty | Error |
|---|---|---|---|
| Wizard StepTemplate | 5 skeleton cards | — (seeds garantizan ≥4) | Full error + retry |
| Wizard publish | Spinner en botón | — | Toast rojo + queda en paso 4 |
| Editor load | Shell + skeleton sidebar + skeleton preview | — | Full error + retry |
| Editor autosave | Indicador en header | — | `⚠ Error` + botón retry |
| Admin templates | Grid skeleton | Empty state si org sin customs (+ CTA Crear) | Full error + retry |
| Admin variables | Sección skeleton por namespace | Solo para `custom`: "Todavía no creaste variables custom" + CTA | Full error + retry |
| Public `/t/[slug]` | Next.js loading.tsx | `notFound()` | Next.js error.tsx |

### 9.2 Permisos

- Agent intenta `/configuracion/tasacion/*` → redirect `/dashboard` + toast.
- Agent intenta editar tasación de otra org → 403 handled con redirect.

### 9.3 `beforeunload` guard

Editor de tasación y editor de template: avisa al cerrar si hay cambios no guardados.

---

## 10. API surface (endpoints consumidos)

Todos ya existen en producción (Sub-plan 1):

| Pantalla | Método | Endpoint | API |
|---|---|---|---|
| Wizard paso 1 | GET | `/appraisal-templates?active=1` | api-admin |
| Wizard publish | POST | `/appraisals` | api-properties |
| Wizard publish slug | POST | `/appraisals/publish?id=X` | api-properties |
| Comparables add | POST | `/appraisals/comparables` | api-properties |
| Comparables delete | DELETE | `/appraisals/comparables?id=X` | api-properties |
| Editor load | GET | `/appraisals?id=X` | api-properties |
| Editor autosave (fields) | PUT | `/appraisals?id=X` | api-properties |
| Editor autosave (overrides) | PATCH | `/appraisals/:id/blocks/:block_id` | api-properties |
| Editor sync template | POST | `/appraisals/:id/sync-template` | api-properties |
| Editor template check | GET | `/appraisal-templates/:id` | api-admin |
| Admin templates list | GET | `/appraisal-templates` | api-admin |
| Admin template CRUD | GET/POST/PUT/DELETE | `/appraisal-templates[/:id]` | api-admin |
| Admin template duplicate | POST | `/appraisal-templates/:id/duplicate` | api-admin |
| Admin variables | GET/POST/PUT/DELETE | `/org-variables[/:id]` | api-admin |
| Public | GET | `/public/appraisal/:slug` | api-public |
| Image upload | POST | `/upload-image` (verificar) | api-properties o api-public |

**Wrappers tipados en `shared/api.ts`** (una función por operación) para evitar strings URL repetidos en componentes.

---

## 11. Testing

### 11.1 Unit (vitest + @testing-library/react)

- `renderer/hydrate-blocks.test.ts` — 5 binding modes, overrides merge, filtrado print, bloques vacíos. **Inputs idénticos a los del test backend**.
- `renderer/TemplateRenderer.test.tsx` — orden, filtrado web vs print, data attrs.
- `renderer/BlockRenderer.test.tsx` — smoke test por tipo (17 tests, incluye UnknownBlock).
- `editor/useAutosave.test.ts` — debounce timing, retry on failure, dirty flag.
- `wizard/use-wizard-form.test.ts` — transiciones de steps, validación por step.

### 11.2 Integration (mock server vía MSW)

- `wizard-flow.test.tsx` — avanzar 4 pasos → verificar POST final con payload correcto.
- `editor-autosave.test.tsx` — tipear field → wait 2s → verificar PUT con payload correcto.
- `editor-override.test.tsx` — editar bloque `default-override` → verificar PATCH.

### 11.3 E2E manual (checklist al cerrar)

- [ ] Agente crea tasación con template Casa → se ve en `/t/[slug]`.
- [ ] Agente edita address → autosave en 2s.
- [ ] Agente edita bloque `work_conditions` → guardado como override → reflejado en preview.
- [ ] Admin duplica template sistema "Casa" → editor permite editarlo.
- [ ] Admin cambia `binding_mode` de un bloque → refleja en preview con mock.
- [ ] Admin crea variable custom `custom.award_count=12` → aparece en bloque que la referencie.
- [ ] Admin reordena bloques con drag-drop → persiste.
- [ ] Admin archivar template → desaparece de list activas.
- [ ] Admin update variable `market.properties_on_sale` → se refleja en las tasaciones que usen `market_stats`.
- [ ] Tasación legacy (sin template_id) renderiza en `/t/[slug]` con `PublicAppraisalShell` (no se rompe).
- [ ] Template actualizado en admin → tasación existente muestra banner sync → click actualiza preservando overrides.
- [ ] Mobile: wizard navegable, editor drawer preview funcional, admin usable (no polish).
- [ ] Landing pública mobile: tipografía grande, stack vertical, CTAs accesibles.
- [ ] `/t/[slug]?print=1` oculta bloques web-only (sin PDF todavía; validación visual).

### 11.4 Lo que NO testeamos (explícito)

- Cada uno de los 16 bloques con todos los variants de data (frágil y caro).
- PDF rendering (Sub-plan 3).
- Browser compat print CSS (se valida con Browser Rendering en Sub-plan 3).

---

## 12. Performance

- `useMemo` de hidratación → sólo re-hidrata si cambian inputs.
- Forms por bloque con state local hasta debounce → no re-render del preview en cada keystroke.
- `/t/[slug]` SSR con `cache: 'no-store'` (evita datos stale).
- Bundle de bloques: considerar dynamic imports por tipo para que la landing pública sólo cargue JS de bloques presentes. **Evaluar al implementar** (si el tree-shaking de Next.js ya resuelve, no agregar complejidad).
- Admin templates list sin paginación (orgs esperadas <20 templates).

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Drift entre tipos del frontend (`renderer/types.ts`) y backend (`core/src/domain`) | Comentario visible al tope; documentar en CLAUDE.md; test de hidratación con fixture idéntico cliente/servidor |
| Editor lento con muchos bloques (>20) | Forms con state local; `<TemplateRenderer/>` con `useMemo`; virtualización sólo si se observa problema |
| Autosave dispara durante save en curso | `useAutosave` cola el último payload; cancela el anterior (AbortController) |
| Admin borra un bloque referenciado en override de tasación existente | Override queda huérfano (merge no encuentra el block.id); `BlockRenderer` ignora. No rompe render |
| Print CSS difiere entre Chromium SSR y browser real | Sub-plan 3 valida con Cloudflare Browser Rendering; acá el preview Print es "best effort" visual |
| Endpoint `/public/appraisal/:slug` no devuelve `resolved_vars` | Primera task del plan verifica y agrega si falta |
| Upload de imágenes sin endpoint existente | Task temprana del plan verifica/agrega endpoint |

---

## 14. Fuera de alcance (YAGNI)

- PDF generation + Browser Rendering binding.
- Legacy migration use case.
- AI editing de bloques (como en landings).
- Versionado de templates.
- Publish workflow con review (las tasaciones publican directo).
- Compartir templates entre orgs.
- Feature flag para rollout gradual (reemplazo directo; legacy sigue via runtime check).

---

## 15. Plan de implementación (alto nivel)

Se detalla en `docs/superpowers/plans/YYYY-MM-DD-tasaciones-templates-frontend.md`. Orden de fases:

1. **Fase A — Renderer foundation**: tipos + `hydrate-blocks` + `<TemplateRenderer/>` + `<BlockRenderer/>` + 4-5 bloques base (cover, property_data, swot, work_conditions, comparables_list). Tests unit.
2. **Fase B — Resto de bloques (12 restantes)**. Tests smoke.
3. **Fase C — Public `/t/[slug]` switch + mover PublicAppraisalShell a `legacy/`**. E2E manual con tasación seed.
4. **Fase D — Wizard** (4 pasos). Integration tests.
5. **Fase E — Editor** (shell + autosave + preview in-place + sync banner). Integration tests.
6. **Fase F — Admin templates** (home + editor + drag-drop).
7. **Fase G — Admin variables + general**.
8. **Fase H — Cleanup legacy steps, E2E manual completo, commit + merge**.

---

**Fin del spec.**
