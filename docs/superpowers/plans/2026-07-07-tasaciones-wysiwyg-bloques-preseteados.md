# Tasaciones — Edición inline de bloques preseteados + fondo en canvas WYSIWYG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los bloques estructurados/preseteados de una tasación (cover, methodology, cta_whatsapp, agent_contact_card, zone_map, y los 12 restantes) se editen directo en el canvas WYSIWYG (`EditableCanvas.tsx`), y agregar color de fondo libre por bloque a los 24 tipos existentes.

**Architecture:** Todo el trabajo es **frontend-only** (`vendepro-frontend`) — el backend (`SetBlockOverridesUseCase`, `UpdateAppraisalUseCase`) ya persiste `block_overrides_json`/`template_snapshot_json` sin validación Zod, así que no hay cambios de esquema ni de API que hacer. El fondo se aplica envolviendo el output de cada bloque en un `<div style={{backgroundColor}}>` genérico (evita tocar los 22 componentes de bloque que no tienen `style` propio en su raíz); los 2 que sí lo tienen (`CoverBlock`, `PriceProjectionBlock`) se ajustan directamente. La edición de texto/imagen simple en 5 tipos estructurados (cover, methodology, cta_whatsapp, agent_contact_card, zone_map) reusa `InlineEditable`/`ImageEditControls` (mismo patrón que los bloques libres). El resto de los tipos estructurados (con listas/arrays o datos calculados) se editan vía un popover nuevo anclado al bloque en el canvas, que reusa el `BlockForm` ya existente — hoy solo disponible en un panel lateral separado.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind, `@dnd-kit`, Vitest + `@testing-library/react`.

## Global Constraints

- Cast todo `await response.json()` como `(await response.json()) as any` (regla del repo).
- Sin `'use client'` innecesario — los componentes de bloque de solo-render no lo llevan; los que ya son `'use client'` (editor/*, blocks con `edit`) lo mantienen.
- No tocar `admin/TemplateEditor.tsx` ni el flujo de templates de Configuración — este plan es exclusivamente para el editor de una tasación puntual (`EditorShell.tsx` / `EditableCanvas.tsx`).
- No agregar campos de imagen a bloques que hoy no la tienen (swot, market_stats, comparables_list, funnel_chart, notary_charts, property_data, proposal_commercial, services_grid, price_projection, cta_whatsapp*, agent_contact_card* — *estos dos sí tienen imagen: avatar/foto, no confundir con "agregar imagen nueva").
- Sin imagen de fondo — solo color sólido.
- Test command: `npx vitest run <path>` desde `vendepro-frontend/` (ver `package.json:11`).

---

### Task 1: Fondo genérico en el renderer (wrapper + fix de Cover/PriceProjection)

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx:297-311` (función `EditableFreeBlock`)
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/PriceProjectionBlock.tsx`
- Test: `vendepro-frontend/src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx:20-23`

**Interfaces:**
- Produces: cualquier bloque cuyo `data`/`resolved_data` tenga `background_color?: string` se pinta con ese color de fondo, en preview del editor, PDF y landing pública. Task 3 (toolbar) y Tasks 5-9 (forms/inline) son los productores de ese campo.

- [ ] **Step 1: Escribir el test que falla**

Editar `vendepro-frontend/src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx` — agregar `background_color` al seed de datos para que el smoke test cubra el nuevo campo en los 24 tipos:

```tsx
      const block: TemplateBlock = {
        id: `b-${type}`, type, binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
        data: { title: 'T', phone: '+5411', videos: [], media: [], services: [{ label: 'S' }], items: [{ title: 'I', body: 'B' }], funnel: [{ label: 'A', value: 1 }], background_color: '#112233' },
      }
```

Crear además `vendepro-frontend/src/components/tasaciones/renderer/__tests__/block-background.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateRenderer } from '../TemplateRenderer'
import type { TemplateBlock, AppraisalContext } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

describe('background_color rendering', () => {
  it('paints a solid background on a block without its own style (methodology)', () => {
    const block: TemplateBlock = {
      id: 'b1', type: 'methodology', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T', background_color: '#112233' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    const wrapper = container.querySelector('[style*="rgb(17, 34, 51)"]')
    expect(wrapper).not.toBeNull()
  })

  it('cover uses a solid background_color instead of the brand gradient when set', () => {
    const block: TemplateBlock = {
      id: 'b2', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T', background_color: '#112233' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    const section = container.querySelector('section')
    expect(section?.getAttribute('style')).toContain('rgb(17, 34, 51)')
    expect(section?.getAttribute('style')).not.toContain('linear-gradient')
  })

  it('renders no extra wrapper when background_color is absent', () => {
    const block: TemplateBlock = {
      id: 'b3', type: 'methodology', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
      data: { title: 'T' },
    }
    const { container } = render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)
    expect(container.querySelector('[style]')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/block-background.test.tsx`
Expected: FAIL — no hay wrapper ni soporte de `background_color` todavía (el primer test no encuentra el estilo; el segundo encuentra `linear-gradient` en vez del color sólido).

- [ ] **Step 3: Implementar el wrapper genérico en `BlockRenderer.tsx`**

Reemplazar el archivo completo `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`:

```tsx
import type { HydratedBlock, AppraisalContext, RenderMode } from './types'
import { blockDataAttrs } from './block-utils'
import { UnknownBlock } from './blocks/UnknownBlock'
import { CoverBlock } from './blocks/CoverBlock'
import { PropertyDataBlock } from './blocks/PropertyDataBlock'
import { SwotBlock } from './blocks/SwotBlock'
import { WorkConditionsBlock } from './blocks/WorkConditionsBlock'
import { ComparablesListBlock } from './blocks/ComparablesListBlock'
import { ProposalCommercialBlock } from './blocks/ProposalCommercialBlock'
import { ServicesGridBlock } from './blocks/ServicesGridBlock'
import { MarketStatsBlock } from './blocks/MarketStatsBlock'
import { FunnelChartBlock } from './blocks/FunnelChartBlock'
import { MethodologyBlock } from './blocks/MethodologyBlock'
import { NotaryChartsBlock } from './blocks/NotaryChartsBlock'
import { ZoneMapBlock } from './blocks/ZoneMapBlock'
import { PriceProjectionBlock } from './blocks/PriceProjectionBlock'
import { VideoGalleryBlock } from './blocks/VideoGalleryBlock'
import { ExtraMediaBlock } from './blocks/ExtraMediaBlock'
import { CtaWhatsappBlock } from './blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from './blocks/AgentContactCardBlock'
import { HeadingBlock } from './blocks/HeadingBlock'
import { RichTextBlock } from './blocks/RichTextBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { GalleryBlock } from './blocks/GalleryBlock'
import { DividerBlock } from './blocks/DividerBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { ButtonLinkBlock } from './blocks/ButtonLinkBlock'

interface Props {
  block: HydratedBlock
  mode: RenderMode
  appraisal: AppraisalContext
}

// Tipos que ya aplican background_color por su cuenta (tienen un `style` propio
// en su elemento raíz que pisaría un wrapper genérico). El resto no define
// `style` en su raíz, así que el wrapper de abajo alcanza sin tocar cada uno.
const SELF_MANAGES_BACKGROUND = new Set(['cover', 'price_projection'])

export function BlockRenderer({ block, mode, appraisal }: Props) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data
  const backgroundColor = (data as { background_color?: string | null }).background_color || undefined

  let content: React.ReactNode
  switch (block.type) {
    case 'cover':
      content = <CoverBlock data={data as any} appraisal={appraisal} {...attrs} />
      break
    case 'property_data':
      content = <PropertyDataBlock data={data as any} {...attrs} />
      break
    case 'swot':
      content = <SwotBlock data={data as any} {...attrs} />
      break
    case 'work_conditions':
      content = <WorkConditionsBlock data={data as any} {...attrs} />
      break
    case 'comparables_list':
      content = <ComparablesListBlock data={data as any} {...attrs} />
      break
    case 'proposal_commercial':
      content = <ProposalCommercialBlock data={data as any} {...attrs} />
      break
    case 'services_grid':
      content = <ServicesGridBlock data={data as any} {...attrs} />
      break
    case 'market_stats':
      content = <MarketStatsBlock data={data as any} {...attrs} />
      break
    case 'funnel_chart':
      content = <FunnelChartBlock data={data as any} {...attrs} />
      break
    case 'methodology':
      content = <MethodologyBlock data={data as any} {...attrs} />
      break
    case 'notary_charts':
      content = <NotaryChartsBlock data={data as any} {...attrs} />
      break
    case 'zone_map':
      content = <ZoneMapBlock data={data as any} {...attrs} />
      break
    case 'price_projection':
      content = <PriceProjectionBlock data={data as any} {...attrs} />
      break
    case 'video_gallery':
      content = <VideoGalleryBlock data={data as any} {...attrs} />
      break
    case 'extra_media':
      content = <ExtraMediaBlock data={data as any} {...attrs} />
      break
    case 'cta_whatsapp':
      content = <CtaWhatsappBlock data={data as any} {...attrs} />
      break
    case 'agent_contact_card':
      content = <AgentContactCardBlock data={data as any} appraisal={appraisal} {...attrs} />
      break
    case 'heading':
      content = <HeadingBlock data={data as any} {...attrs} />
      break
    case 'rich_text':
      content = <RichTextBlock data={data as any} {...attrs} />
      break
    case 'image':
      content = <ImageBlock data={data as any} {...attrs} />
      break
    case 'gallery':
      content = <GalleryBlock data={data as any} {...attrs} />
      break
    case 'divider':
      content = <DividerBlock data={data as any} {...attrs} />
      break
    case 'callout':
      content = <CalloutBlock data={data as any} {...attrs} />
      break
    case 'button_link':
      content = <ButtonLinkBlock data={data as any} {...attrs} />
      break
    default:
      content = <UnknownBlock type={block.type} {...attrs} />
  }

  if (!backgroundColor || SELF_MANAGES_BACKGROUND.has(block.type)) return content
  return <div style={{ backgroundColor }}>{content}</div>
}
```

- [ ] **Step 4: Implementar el wrapper en `EditableFreeBlock` (`EditableCanvas.tsx`)**

En `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx`, reemplazar la función `EditableFreeBlock` (líneas 297-311):

```tsx
function EditableFreeBlock({ block, onChange }: { block: TemplateBlock; onChange: (patch: Record<string, unknown>) => void }) {
  const attrs = blockDataAttrs(block)
  const data = block.data as any
  const edit = { onChange }
  let content: React.ReactNode
  switch (block.type) {
    case 'heading': content = <HeadingBlock data={data} edit={edit} {...attrs} />; break
    case 'rich_text': content = <RichTextBlock data={data} edit={edit} {...attrs} />; break
    case 'image': content = <ImageBlock data={data} edit={edit} {...attrs} />; break
    case 'gallery': content = <GalleryBlock data={data} edit={edit} {...attrs} />; break
    case 'divider': content = <DividerBlock data={data} edit={edit} {...attrs} />; break
    case 'callout': content = <CalloutBlock data={data} edit={edit} {...attrs} />; break
    case 'button_link': content = <ButtonLinkBlock data={data} edit={edit} {...attrs} />; break
    default: return null
  }
  return data.background_color ? <div style={{ backgroundColor: data.background_color }}>{content}</div> : content
}
```

- [ ] **Step 5: Arreglar `CoverBlock.tsx` para que `background_color` reemplace el degradé**

Reemplazar el archivo completo `vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx`:

```tsx
import type { AppraisalContext } from '../types'

interface CoverData {
  title?: string
  subtitle?: string
  cover_image_url?: string | null
  background_color?: string | null
  agent_display?: {
    name?: string
    phone?: string
    email?: string
    avatar_url?: string | null
  }
}

interface Props {
  data: CoverData
  appraisal: AppraisalContext
  [key: `data-${string}`]: string | undefined
}

export function CoverBlock({ data, appraisal, ...attrs }: Props) {
  const agent = data.agent_display ?? appraisal.agent ?? undefined
  const hasCoverImage = !!data.cover_image_url
  // Sin imagen de portada el degradado queda enorme y vacío: achicamos la
  // altura para que el header sea compacto. Con imagen mantenemos el tamaño full.
  const sizeClasses = hasCoverImage
    ? 'min-h-[80vh] py-16 md:min-h-screen'
    : 'min-h-[40vh] py-12 md:min-h-[50vh]'
  const sectionStyle = data.background_color
    ? { backgroundColor: data.background_color }
    : { backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }
  return (
    <section
      {...attrs}
      className={`relative flex items-end text-white px-6 md:px-12 ${sizeClasses}`}
      style={sectionStyle}
    >
      {data.cover_image_url && (
        <img src={data.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      {appraisal.org?.logo_url && (
        <img
          src={appraisal.org.logo_url}
          alt={appraisal.org.name ?? ''}
          className="absolute top-6 left-6 z-10 h-10 w-auto object-contain md:top-12 md:left-12 md:h-14"
        />
      )}
      <div className="relative z-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-90 md:text-sm">
          Tasación profesional
        </p>
        <h1 className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl">
          {data.title ?? '¿Querés saber cuánto vale tu propiedad?'}
        </h1>
        {data.subtitle && <p className="mt-3 text-lg opacity-90 md:text-xl">{data.subtitle}</p>}
        <p className="mt-6 text-sm opacity-90 md:text-base">
          {appraisal.property_address}
          {appraisal.neighborhood ? ` · ${appraisal.neighborhood}` : ''}
        </p>
        {agent?.name && (
          <div className="mt-8 flex items-center gap-3">
            {agent.avatar_url && <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30" />}
            <div>
              <p className="font-semibold">{agent.name}</p>
              {agent.phone && <p className="text-sm opacity-80">{agent.phone}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Arreglar `PriceProjectionBlock.tsx` de la misma forma**

Reemplazar el archivo completo `vendepro-frontend/src/components/tasaciones/renderer/blocks/PriceProjectionBlock.tsx`:

```tsx
interface Data {
  title?: string
  suggested?: number | null
  test?: number | null
  expected_close?: number | null
  usd_per_m2?: number | null
  background_color?: string | null
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

function money(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PriceProjectionBlock({ data, ...attrs }: Props) {
  const suggested = money(data.suggested)
  const test = money(data.test)
  const close = money(data.expected_close)
  const sectionStyle = data.background_color
    ? { backgroundColor: data.background_color }
    : { backgroundImage: BRAND_GRADIENT }

  return (
    <section
      {...attrs}
      className="relative overflow-hidden px-6 py-16 text-white md:px-12 md:py-24"
      style={sectionStyle}
    >
      <div className="relative z-10 mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 md:text-sm">
          Estrategia de precio
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight md:text-5xl">
          {data.title ?? 'Tasación proyectada'}
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-white/80 md:text-base">
          Basada en el análisis de comparables, las condiciones del mercado y los objetivos comerciales acordados.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3">
          <article className="rounded-3xl bg-white/15 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Publicación sugerida</p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {suggested ?? <span className="text-white/40">—</span>}
            </p>
            <p className="mt-3 text-xs text-white/70">Precio recomendado para salir al mercado.</p>
          </article>

          <article className="rounded-3xl bg-white/15 p-6 backdrop-blur-sm md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Precio de prueba</p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {test ?? <span className="text-white/40">—</span>}
            </p>
            <p className="mt-3 text-xs text-white/70">Valor inicial para testear interés del mercado.</p>
          </article>

          <article
            className="relative rounded-3xl bg-white p-6 text-slate-900 shadow-xl md:p-8"
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--brand-color, #ff007c)' }}
            >
              Cierre esperado
            </p>
            <p className="mt-3 font-poppins text-3xl font-bold leading-none md:text-4xl">
              {close ?? <span className="text-slate-300">—</span>}
            </p>
            <p className="mt-3 text-xs text-slate-500">Valor estimado al firmar la operación.</p>
          </article>
        </div>

        {data.usd_per_m2 != null && (
          <p className="mt-10 text-sm text-white/85 md:mt-12 md:text-base">
            <span className="font-semibold">{data.usd_per_m2}</span>
            <span className="ml-1 text-white/70">USD por m²</span>
          </p>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/block-background.test.tsx src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx`
Expected: PASS (todos los tests, incluyendo los 24 tipos del smoke test con `background_color` en el seed).

- [ ] **Step 8: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/blocks/PriceProjectionBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx vendepro-frontend/src/components/tasaciones/renderer/__tests__/block-background.test.tsx
git commit -m "feat(tasaciones): soporte genérico de background_color en el renderer de bloques"
```

---

### Task 2: Habilitar edición real de bloques bloqueados en `BlockForm`

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/editor/BlockForm.tsx`
- Test: crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockForm.test.tsx`

**Interfaces:**
- Consumes: nada nuevo (usa los mismos `block-forms/*` ya existentes).
- Produces: `BlockForm` ahora SIEMPRE renderiza el form correspondiente cuando `context === 'appraisal'`, sin importar `binding_mode`; agrega un aviso cuando el bloque viene bloqueado del template. Esto es lo que consume Task 4 (popover) y lo que ya usa `BlockList.tsx` (panel lateral, sin cambios).
- El comportamiento para `context === 'template'` (admin) NO cambia — sigue bloqueado igual que hoy.

- [ ] **Step 1: Escribir el test que falla**

Crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockForm } from '../BlockForm'
import type { TemplateBlock } from '../../renderer/types'

function block(binding_mode: TemplateBlock['binding_mode']): TemplateBlock {
  return { id: 'b1', type: 'methodology', binding_mode, include_in_pdf: true, sort_order: 0, data: { title: 'T' } }
}

describe('BlockForm — edición de bloques bloqueados', () => {
  it('en context=appraisal, renderiza el form real incluso si el binding_mode es system', () => {
    render(<BlockForm block={block('system')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.getByText(/título/i)).toBeInTheDocument()
    expect(screen.queryByText(/se configura desde configuración/i)).not.toBeInTheDocument()
  })

  it('en context=appraisal con binding_mode bloqueado, muestra el aviso de override', () => {
    render(<BlockForm block={block('org-static')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.getByText(/solo aplican a esta tasación/i)).toBeInTheDocument()
  })

  it('en context=appraisal con binding_mode tasacion, NO muestra el aviso de override', () => {
    render(<BlockForm block={block('tasacion')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.queryByText(/solo aplican a esta tasación/i)).not.toBeInTheDocument()
  })

  it('en context=template con binding_mode bloqueado, se mantiene el bloqueo original', () => {
    render(<BlockForm block={block('system')} override={{}} onPatch={vi.fn()} context="template" />)
    expect(screen.getByText(/se configura desde configuración/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/BlockForm.test.tsx`
Expected: FAIL — hoy `context=appraisal` con `binding_mode='system'`/`'org-static'` muestra el mensaje de bloqueo en vez del form.

- [ ] **Step 3: Implementar el cambio**

Reemplazar el archivo completo `vendepro-frontend/src/components/tasaciones/editor/BlockForm.tsx`:

```tsx
'use client'
import type { TemplateBlock, BindingMode } from '../renderer/types'
import { ProposalCommercialForm } from './block-forms/ProposalCommercialForm'
import { ServicesGridForm } from './block-forms/ServicesGridForm'
import { MarketStatsForm } from './block-forms/MarketStatsForm'
import { FunnelChartForm } from './block-forms/FunnelChartForm'
import { MethodologyForm } from './block-forms/MethodologyForm'
import { NotaryChartsForm } from './block-forms/NotaryChartsForm'
import { ZoneMapForm } from './block-forms/ZoneMapForm'
import { ComparablesListForm } from './block-forms/ComparablesListForm'
import { WorkConditionsForm } from './block-forms/WorkConditionsForm'
import { VideoGalleryForm } from './block-forms/VideoGalleryForm'
import { ExtraMediaForm } from './block-forms/ExtraMediaForm'
import { CtaWhatsappForm } from './block-forms/CtaWhatsappForm'
import { AgentContactCardForm } from './block-forms/AgentContactCardForm'
import { CoverForm } from './block-forms/CoverForm'

interface Props {
  block: TemplateBlock
  override: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
  context: 'appraisal' | 'template'
  /** true = se usa dentro del popover angosto del canvas (fuerza layouts de una columna). */
  compact?: boolean
}

const TASACION_EDITABLE: Set<BindingMode> = new Set(['tasacion', 'default-override'])

export function BlockForm({ block, override, onPatch, context, compact }: Props) {
  const isLockedInTemplate = context === 'template' && !TASACION_EDITABLE.has(block.binding_mode)
  if (isLockedInTemplate) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Este bloque se configura desde Configuración → Tasación → Templates.
      </div>
    )
  }

  const isLockedInAppraisal = context === 'appraisal' && !TASACION_EDITABLE.has(block.binding_mode)
  const merged = { ...block.data, ...override }
  const props = { data: merged, onPatch }

  return (
    <div>
      {isLockedInAppraisal && (
        <div className="mx-3 mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Este bloque viene del template. Los cambios acá solo aplican a esta tasación (no afectan al template).
        </div>
      )}
      {(() => {
        switch (block.type) {
          case 'cover': return <CoverForm {...props} />
          case 'proposal_commercial': return <ProposalCommercialForm {...props} />
          case 'services_grid': return <ServicesGridForm {...props} />
          case 'market_stats': return <MarketStatsForm {...props} />
          case 'funnel_chart': return <FunnelChartForm {...props} />
          case 'methodology': return <MethodologyForm {...props} />
          case 'notary_charts': return <NotaryChartsForm {...props} compact={compact} />
          case 'zone_map': return <ZoneMapForm {...props} />
          case 'comparables_list': return <ComparablesListForm {...props} />
          case 'price_projection': return <div className="p-3 text-xs text-slate-500">Se completa con los precios del paso "FODA + Precios".</div>
          case 'work_conditions': return <WorkConditionsForm {...props} />
          case 'video_gallery': return <VideoGalleryForm {...props} />
          case 'extra_media': return <ExtraMediaForm {...props} />
          case 'cta_whatsapp': return <CtaWhatsappForm {...props} />
          case 'agent_contact_card': return <AgentContactCardForm {...props} />
          case 'swot':
          case 'property_data':
            return <div className="p-3 text-xs text-slate-500">Se completa con los datos de la propiedad / FODA en el panel de arriba.</div>
          default: return null
        }
      })()}
    </div>
  )
}
```

- [ ] **Step 4: Agregar el prop `compact` a `NotaryChartsForm`**

En `vendepro-frontend/src/components/tasaciones/editor/block-forms/NotaryChartsForm.tsx`, cambiar la firma y la clase del grid:

```tsx
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void; compact?: boolean }

export function NotaryChartsForm({ data, onPatch, compact }: Props) {
```

y más abajo:

```tsx
      <div className={`grid grid-cols-1 gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
```

(el resto del archivo no cambia — `compact` por defecto es `undefined`/falsy, así que el panel lateral sigue viéndose igual que hoy).

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/BlockForm.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/editor/BlockForm.tsx vendepro-frontend/src/components/tasaciones/editor/block-forms/NotaryChartsForm.tsx vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockForm.test.tsx
git commit -m "feat(tasaciones): permitir editar (vía override) bloques bloqueados del template en la tasación"
```

---

### Task 3: Botón de color de fondo en la toolbar del canvas

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx:356-366`
- Test: crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`

**Interfaces:**
- Consumes: `onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void` — nuevo prop de `EditableCanvas`, análogo al `onPatchOverride` que `EditorShell` ya pasa a `BlockList` (línea 340: `dispatch({ type: 'patch_override', blockId: id, patch })`).
- Produces: cualquier bloque (libre o estructurado) muestra un botón de color de fondo en su rail de controles; bloques libres persisten con `onPatchData` (mutación directa del snapshot), bloques estructurados con `onPatchOverride` (mismo mecanismo que ya usa `BlockList`/`BlockForm`).

- [ ] **Step 1: Escribir el test que falla**

Crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EditableCanvas } from '../EditableCanvas'
import type { AppraisalContext, TemplateBlock } from '../../renderer/types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

function noop() {}

describe('EditableCanvas — color de fondo', () => {
  it('un bloque libre (heading) persiste el fondo vía onPatchData', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b1', type: 'heading', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { text: 'Hola' } }]
    const onPatchData = vi.fn()
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={onPatchData} onPatchOverride={onPatchOverride}
      />
    )
    fireEvent.click(screen.getByTitle('Color de fondo'))
    fireEvent.change(screen.getByLabelText('Elegir color de fondo'), { target: { value: '#112233' } })
    expect(onPatchData).toHaveBeenCalledWith('b1', { background_color: '#112233' })
    expect(onPatchOverride).not.toHaveBeenCalled()
  })

  it('un bloque estructurado (methodology) persiste el fondo vía onPatchOverride', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b2', type: 'methodology', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { title: 'M' } }]
    const onPatchData = vi.fn()
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={onPatchData} onPatchOverride={onPatchOverride}
      />
    )
    fireEvent.click(screen.getByTitle('Color de fondo'))
    fireEvent.change(screen.getByLabelText('Elegir color de fondo'), { target: { value: '#445566' } })
    expect(onPatchOverride).toHaveBeenCalledWith('b2', { background_color: '#445566' })
    expect(onPatchData).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`
Expected: FAIL — no existe el botón "Color de fondo" ni el prop `onPatchOverride`.

- [ ] **Step 3: Agregar el prop `onPatchOverride` y el botón de fondo en `EditableCanvas.tsx`**

En `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx`, agregar el import de un ícono nuevo (línea 8-11, agregar `PaintBucket` al import de `lucide-react`):

```tsx
import {
  GripVertical, Trash2, Plus, Lock, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Type, Image as ImageIcon, Images, Minus, Quote, Link2, AlertTriangle,
  PaintBucket,
} from 'lucide-react'
```

Extender `Props` (líneas 28-39) con el nuevo callback:

```tsx
interface Props {
  snapshot: TemplateBlock[]
  overrides: BlockOverrides
  appraisal: AppraisalContext
  mode: RenderMode
  onAdd: (type: AppraisalBlockType, atIndex: number) => void
  onRemove: (blockId: string) => void
  onReorder: (from: number, to: number) => void
  onPatchData: (blockId: string, patch: Record<string, unknown>) => void
  /** Persiste un patch de un bloque bloqueado del template como override puntual de esta tasación. */
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  /** Abre el formulario del bloque estructurado (edición vía overrides). */
  onEditStructured?: (blockId: string) => void
}
```

Actualizar la firma de `EditableCanvas` (línea 52-53) para desestructurar `onPatchOverride`, y dentro del `.map` (línea 85-110) calcular el color de fondo actual y la función de persistencia por bloque, pasándolos a `SortableBlock`:

```tsx
export function EditableCanvas({
  snapshot, overrides, appraisal, mode, onAdd, onRemove, onReorder, onPatchData, onPatchOverride, onEditStructured,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const hydrated = useMemo(
    () => hydrateBlocks({ snapshot, overrides, appraisal, resolvedVars: {}, mode }),
    [snapshot, overrides, appraisal, mode],
  )

  const brandStyle = {
    '--brand-color': appraisal.org?.brand_color ?? '#ff007c',
    '--brand-accent-color': appraisal.org?.brand_accent_color ?? '#e17a2a',
  } as React.CSSProperties

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = snapshot.findIndex(b => b.id === active.id)
    const to = snapshot.findIndex(b => b.id === over.id)
    if (from >= 0 && to >= 0) onReorder(from, to)
  }

  return (
    <div style={brandStyle} className="bg-white">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={snapshot.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {/* Insertar al principio */}
          <InsertZone onInsert={(t) => onAdd(t, 0)} />
          {snapshot.map((block, index) => {
            const h = hydrated.find(x => x.id === block.id)
            const isFree = FREE_BLOCK_TYPES.has(block.type)
            const completeness = h ? getBlockCompleteness(h, appraisal) : { complete: true, missingLabel: null }
            const backgroundColor = isFree
              ? ((block.data as any).background_color ?? null)
              : ((h?.resolved_data as any)?.background_color ?? null)
            const persistPatch = (patch: Record<string, unknown>) =>
              isFree ? onPatchData(block.id, patch) : onPatchOverride(block.id, patch)
            return (
              <div key={block.id}>
                <SortableBlock
                  block={block}
                  selected={selectedId === block.id}
                  isFree={isFree}
                  incomplete={!completeness.complete}
                  missingLabel={completeness.missingLabel}
                  backgroundColor={backgroundColor}
                  onBackgroundChange={(color) => persistPatch({ background_color: color })}
                  onSelect={() => setSelectedId(block.id)}
                  onRemove={() => onRemove(block.id)}
                  onPatchData={(patch) => onPatchData(block.id, patch)}
                  onEditStructured={onEditStructured ? () => onEditStructured(block.id) : undefined}
                >
                  {isFree
                    ? <EditableFreeBlock block={block} onChange={(patch) => onPatchData(block.id, patch)} />
                    : (h ? <BlockRenderer block={h} mode={mode} appraisal={appraisal} /> : null)}
                </SortableBlock>
                {/* Insertar después de este bloque */}
                <InsertZone onInsert={(t) => onAdd(t, index + 1)} />
              </div>
            )
          })}
          {snapshot.length === 0 && (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center text-slate-400">
              <Plus className="mb-2 h-8 w-8" />
              <p className="text-sm">Agregá tu primer elemento con el botón <span className="font-medium">+</span> de arriba.</p>
            </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

Extender `SortableBlock` (líneas 123-208) para recibir y usar los dos props nuevos, agregando el botón al rail de la derecha:

```tsx
function SortableBlock({
  block, selected, isFree, incomplete, missingLabel, backgroundColor, children,
  onSelect, onRemove, onPatchData, onEditStructured, onBackgroundChange,
}: {
  block: TemplateBlock
  selected: boolean
  isFree: boolean
  incomplete: boolean
  missingLabel: string | null
  backgroundColor: string | null
  children: React.ReactNode
  onSelect: () => void
  onRemove: () => void
  onPatchData: (patch: Record<string, unknown>) => void
  onEditStructured?: () => void
  onBackgroundChange: (color: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative border-y-2 transition-colors ${
        selected ? 'border-brand-pink/70' : 'border-transparent hover:border-brand-pink/20'
      }`}
    >
      {/* Rail de controles */}
      <div className={`absolute left-1 top-1 z-20 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab rounded bg-white/90 p-1 text-slate-500 shadow-sm hover:text-slate-800 active:cursor-grabbing"
          title="Arrastrar para reordenar"
          aria-label="Reordenar bloque"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500 shadow-sm">
          {getBlockMeta(block.type).label}
        </span>
        {!isFree && (
          <span className="flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-400 shadow-sm" title="Bloque del template">
            <Lock className="h-3 w-3" /> template
          </span>
        )}
      </div>

      <div className={`absolute right-1 top-1 z-20 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <BackgroundColorButton value={backgroundColor} onChange={onBackgroundChange} />
        {!isFree && onEditStructured && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditStructured() }}
            className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:text-brand-pink"
          >
            Editar campos
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar este bloque de la tasación?')) onRemove() }}
          className="rounded bg-white/90 p-1 text-slate-400 shadow-sm hover:text-rose-600"
          title="Eliminar bloque"
          aria-label="Eliminar bloque"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar de opciones del bloque libre seleccionado */}
      {isFree && selected && (
        <div className="absolute left-1/2 top-1 z-20 -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
          <FreeBlockToolbar block={block} onPatch={onPatchData} />
        </div>
      )}

      {incomplete && (
        <div className="flex items-center gap-1.5 bg-amber-50 px-4 py-1 text-[11px] text-amber-800">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          No se va a publicar{missingLabel ? ` — falta ${missingLabel}.` : ' porque faltan datos.'}
        </div>
      )}

      {children}
    </div>
  )
}

function BackgroundColorButton({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="rounded bg-white/90 p-1 text-slate-400 shadow-sm hover:text-slate-700"
        title="Color de fondo"
        aria-label="Color de fondo del bloque"
      >
        <PaintBucket className="h-4 w-4" style={value ? { color: value } : undefined} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-30 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <input
              type="color"
              value={value ?? '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-7 rounded border border-slate-300 p-0.5"
              aria-label="Elegir color de fondo"
            />
            {value && (
              <button onClick={() => { onChange(null); setOpen(false) }} className="text-xs text-slate-500 hover:text-rose-600">
                Quitar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wirear el nuevo prop en `EditorShell.tsx`**

En `vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx:356-366`, agregar `onPatchOverride`:

```tsx
              <EditableCanvas
                snapshot={state.snapshot}
                overrides={state.overrides}
                appraisal={ctx}
                mode="web"
                onAdd={addBlock}
                onRemove={(id) => dispatch({ type: 'remove_block', blockId: id })}
                onReorder={(from, to) => dispatch({ type: 'reorder_blocks', from, to })}
                onPatchData={(id, patch) => dispatch({ type: 'patch_block_data', blockId: id, patch })}
                onPatchOverride={(id, patch) => dispatch({ type: 'patch_override', blockId: id, patch })}
                onEditStructured={(id) => { setSidebarCollapsed(false); setOpenBlockId(id) }}
              />
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx vendepro-frontend/src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx
git commit -m "feat(tasaciones): botón de color de fondo por bloque en el canvas WYSIWYG"
```

---

### Task 4: Popover anclado para editar bloques con listas/datos calculados

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/BlockEditPopover.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx` (botón "Editar campos")
- Test: crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockEditPopover.test.tsx`

**Interfaces:**
- Consumes: `BlockForm` (Task 2, con prop `compact`), `getBlockMeta` de `renderer/block-catalog.ts`.
- Produces: `<BlockEditPopover block override onPatch onClose>` — popover flotante que renderiza `<BlockForm block={block} override={override} onPatch={onPatch} context="appraisal" compact />` con un título y botón de cierre. Se usa desde `EditableCanvas.tsx` en vez de navegar al panel lateral.

- [ ] **Step 1: Escribir el test que falla**

Crear `vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockEditPopover.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockEditPopover } from '../BlockEditPopover'
import type { TemplateBlock } from '../../renderer/types'

describe('BlockEditPopover', () => {
  it('renderiza el BlockForm del tipo de bloque y el título del bloque', () => {
    const block: TemplateBlock = { id: 'b1', type: 'services_grid', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { services: [] } }
    render(<BlockEditPopover block={block} override={{}} onPatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Nuestros servicios')).toBeInTheDocument()
    expect(screen.getByText('+ Agregar')).toBeInTheDocument()
  })

  it('llama a onClose al hacer click en el botón de cerrar', () => {
    const block: TemplateBlock = { id: 'b1', type: 'swot', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {} }
    const onClose = vi.fn()
    render(<BlockEditPopover block={block} override={{}} onPatch={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Cerrar edición'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/BlockEditPopover.test.tsx`
Expected: FAIL — el archivo `BlockEditPopover.tsx` no existe.

- [ ] **Step 3: Crear `BlockEditPopover.tsx`**

```tsx
'use client'
import { X } from 'lucide-react'
import type { TemplateBlock } from '../renderer/types'
import { getBlockMeta } from '../renderer/block-catalog'
import { BlockForm } from './BlockForm'

interface Props {
  block: TemplateBlock
  override: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
  onClose: () => void
}

export function BlockEditPopover({ block, override, onPatch, onClose }: Props) {
  return (
    <div className="w-80 rounded-xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">{getBlockMeta(block.type).label}</span>
        <button onClick={onClose} className="rounded p-0.5 text-slate-400 hover:text-slate-700" aria-label="Cerrar edición">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <BlockForm block={block} override={override} onPatch={onPatch} context="appraisal" compact />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Reemplazar la navegación al panel lateral por el popover en `EditableCanvas.tsx`**

En `EditableCanvas.tsx`, importar `BlockEditPopover` junto a los otros imports de bloques libres:

```tsx
import { BlockEditPopover } from './BlockEditPopover'
```

En el `Props` de `EditableCanvas`, cambiar `onEditStructured` de callback-que-navega a un consumidor de override directo — reemplazar la línea `onEditStructured?: (blockId: string) => void` por:

```tsx
  /** Overrides actuales, para prellenar el popover de edición de bloques estructurados. */
  overrides: BlockOverrides
```

(este prop ya existe en `Props` desde antes — no se duplica, solo se aprovecha).

En el estado del componente `EditableCanvas` (junto a `selectedId`), agregar:

```tsx
  const [editingId, setEditingId] = useState<string | null>(null)
```

En el `.map` de bloques, donde antes se pasaba `onEditStructured` a `SortableBlock`, cambiar la prop para abrir el popover local en vez de delegar hacia arriba:

```tsx
                <SortableBlock
                  block={block}
                  selected={selectedId === block.id}
                  isFree={isFree}
                  incomplete={!completeness.complete}
                  missingLabel={completeness.missingLabel}
                  backgroundColor={backgroundColor}
                  onBackgroundChange={(color) => persistPatch({ background_color: color })}
                  onSelect={() => setSelectedId(block.id)}
                  onRemove={() => onRemove(block.id)}
                  onPatchData={(patch) => onPatchData(block.id, patch)}
                  onEditStructured={!isFree ? () => setEditingId(block.id) : undefined}
                >
                  {isFree
                    ? <EditableFreeBlock block={block} onChange={(patch) => onPatchData(block.id, patch)} />
                    : (h ? <BlockRenderer block={h} mode={mode} appraisal={appraisal} /> : null)}
                  {editingId === block.id && (
                    <div className="absolute right-2 top-10 z-30">
                      <BlockEditPopover
                        block={block}
                        override={overrides[block.id] ?? {}}
                        onPatch={(patch) => onPatchOverride(block.id, patch)}
                        onClose={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </SortableBlock>
```

Nota: `SortableBlock`'s contenedor raíz ya es `relative` (línea 142-149 original), así que el `absolute` del popover se ancla correctamente contra ese bloque. Quitar el prop `onEditStructured` de `EditorShell.tsx` ya no es necesario tocarlo — sigue existiendo por compatibilidad con el flujo del panel lateral (`setOpenBlockId`), que se deja intacto (spec §4: "no se elimina en este alcance").

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/BlockEditPopover.test.tsx src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/editor/BlockEditPopover.tsx vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx vendepro-frontend/src/components/tasaciones/editor/__tests__/BlockEditPopover.test.tsx
git commit -m "feat(tasaciones): popover anclado en el canvas para editar bloques con listas/datos calculados"
```

---

### Task 5: Edición inline — CoverBlock y MethodologyBlock

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx` (de Task 1)
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/MethodologyBlock.tsx`
- Test: `vendepro-frontend/src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx` (ya cubre no-crash; se agrega un test de comportamiento dedicado)

**Interfaces:**
- Consumes: `InlineEditable` (`./InlineEditable`), `ImageEditControls` (`./ImageEditControls`) — mismos componentes que ya usan `HeadingBlock`/`ImageBlock`.
- Produces: `CoverBlock`/`MethodologyBlock` ahora aceptan `edit?: { onChange: (patch) => void }`; cuando está presente, título/subtítulo/body/highlight_text son contenteditable y la imagen es reemplazable inline. Task 8 conecta esto al canvas.

- [ ] **Step 1: Escribir el test que falla**

Crear `vendepro-frontend/src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CoverBlock } from '../blocks/CoverBlock'
import { MethodologyBlock } from '../blocks/MethodologyBlock'
import type { AppraisalContext } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'Calle 123', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

describe('CoverBlock — edición inline', () => {
  it('sin edit, el título se muestra como texto plano', () => {
    render(<CoverBlock data={{ title: 'Hola' }} appraisal={appraisal} />)
    expect(screen.getByText('Hola').getAttribute('contenteditable')).toBeNull()
  })

  it('con edit, el título es contenteditable y commitea via onCommit', () => {
    const onChange = vi.fn()
    render(<CoverBlock data={{ title: 'Hola' }} appraisal={appraisal} edit={{ onChange }} />)
    const titleEl = screen.getByText('Hola')
    expect(titleEl.getAttribute('contenteditable')).toBe('true')
    titleEl.textContent = 'Chau'
    fireEvent.blur(titleEl)
    expect(onChange).toHaveBeenCalledWith({ title: 'Chau' })
  })
})

describe('MethodologyBlock — edición inline', () => {
  it('con edit, el body es contenteditable y commitea via onCommit', () => {
    const onChange = vi.fn()
    render(<MethodologyBlock data={{ title: 'M', body: 'Cuerpo' }} edit={{ onChange }} />)
    const bodyEl = screen.getByText('Cuerpo')
    bodyEl.textContent = 'Nuevo cuerpo'
    fireEvent.blur(bodyEl)
    expect(onChange).toHaveBeenCalledWith({ body: 'Nuevo cuerpo' })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: FAIL — `CoverBlock`/`MethodologyBlock` no aceptan `edit` todavía.

- [ ] **Step 3: Agregar `edit` a `CoverBlock.tsx`**

Reemplazar el archivo completo (toma como base la versión ya escrita en Task 1, sumando `edit`):

```tsx
import type { AppraisalContext } from '../types'
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface CoverData {
  title?: string
  subtitle?: string
  cover_image_url?: string | null
  background_color?: string | null
  agent_display?: {
    name?: string
    phone?: string
    email?: string
    avatar_url?: string | null
  }
}

interface Props {
  data: CoverData
  appraisal: AppraisalContext
  edit?: { onChange: (patch: Partial<CoverData>) => void }
  [key: `data-${string}`]: string | undefined
}

export function CoverBlock({ data, appraisal, edit, ...attrs }: Props) {
  const agent = data.agent_display ?? appraisal.agent ?? undefined
  const hasCoverImage = !!data.cover_image_url
  const sizeClasses = hasCoverImage
    ? 'min-h-[80vh] py-16 md:min-h-screen'
    : 'min-h-[40vh] py-12 md:min-h-[50vh]'
  const sectionStyle = data.background_color
    ? { backgroundColor: data.background_color }
    : { backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }
  return (
    <section
      {...attrs}
      className={`relative flex items-end text-white px-6 md:px-12 ${sizeClasses}`}
      style={sectionStyle}
    >
      {data.cover_image_url && (
        <img src={data.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      {edit && (
        <div className="absolute right-4 top-4 z-20">
          <ImageEditControls compact={hasCoverImage} onUploaded={(url) => edit.onChange({ cover_image_url: url })} />
        </div>
      )}
      {appraisal.org?.logo_url && (
        <img
          src={appraisal.org.logo_url}
          alt={appraisal.org.name ?? ''}
          className="absolute top-6 left-6 z-10 h-10 w-auto object-contain md:top-12 md:left-12 md:h-14"
        />
      )}
      <div className="relative z-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-90 md:text-sm">
          Tasación profesional
        </p>
        {edit ? (
          <InlineEditable
            as="h1"
            plaintext
            value={data.title ?? ''}
            placeholder="¿Querés saber cuánto vale tu propiedad?"
            className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl"
            onCommit={(title) => edit.onChange({ title })}
          />
        ) : (
          <h1 className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl">
            {data.title ?? '¿Querés saber cuánto vale tu propiedad?'}
          </h1>
        )}
        {edit ? (
          <InlineEditable
            as="p"
            plaintext
            value={data.subtitle ?? ''}
            placeholder="Subtítulo (opcional)…"
            className="mt-3 text-lg opacity-90 md:text-xl"
            onCommit={(subtitle) => edit.onChange({ subtitle })}
          />
        ) : data.subtitle ? (
          <p className="mt-3 text-lg opacity-90 md:text-xl">{data.subtitle}</p>
        ) : null}
        <p className="mt-6 text-sm opacity-90 md:text-base">
          {appraisal.property_address}
          {appraisal.neighborhood ? ` · ${appraisal.neighborhood}` : ''}
        </p>
        {agent?.name && (
          <div className="mt-8 flex items-center gap-3">
            {agent.avatar_url && <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30" />}
            <div>
              <p className="font-semibold">{agent.name}</p>
              {agent.phone && <p className="text-sm opacity-80">{agent.phone}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Agregar `edit` a `MethodologyBlock.tsx`**

Reemplazar el archivo completo:

```tsx
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface Data { title?: string; body?: string; image_url?: string | null; highlight_text?: string; background_color?: string | null }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function MethodologyBlock({ data, edit, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-[#f2f2f2] px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
              style={{ color: 'var(--brand-color, #ff007c)' }}
            >
              Cómo trabajamos
            </p>
            {edit ? (
              <InlineEditable
                as="h2"
                plaintext
                value={data.title ?? ''}
                placeholder="Nuestra metodología"
                className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl"
                onCommit={(title) => edit.onChange({ title })}
              />
            ) : (
              <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
                {data.title ?? 'Nuestra metodología'}
              </h2>
            )}
            {edit ? (
              <InlineEditable
                as="p"
                plaintext
                value={data.body ?? ''}
                placeholder="Contá los pasos de tu proceso de venta…"
                className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-700 md:text-lg"
                onCommit={(body) => edit.onChange({ body })}
              />
            ) : data.body ? (
              <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-slate-700 md:text-lg">
                {data.body}
              </p>
            ) : null}
            {(edit || data.highlight_text) && (
              <div className="mt-8 rounded-2xl bg-white px-6 py-5 shadow-sm">
                <span
                  className="text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--brand-color, #ff007c)' }}
                >
                  Lo que nos diferencia
                </span>
                {edit ? (
                  <InlineEditable
                    as="p"
                    plaintext
                    value={data.highlight_text ?? ''}
                    placeholder="Ej: 100% métricas en cada publicación."
                    className="mt-2 text-lg font-semibold leading-snug text-slate-900 md:text-xl"
                    onCommit={(highlight_text) => edit.onChange({ highlight_text })}
                  />
                ) : (
                  <p className="mt-2 text-lg font-semibold leading-snug text-slate-900 md:text-xl">
                    {data.highlight_text}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            {data.image_url ? (
              <div className="relative">
                <img
                  src={data.image_url}
                  alt={data.title ?? ''}
                  className="w-full rounded-3xl object-cover shadow-lg"
                />
                <span
                  className="absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-full md:block"
                  style={{ backgroundImage: BRAND_GRADIENT }}
                />
                {edit && (
                  <div className="absolute right-2 top-2">
                    <ImageEditControls compact onUploaded={(url) => edit.onChange({ image_url: url })} />
                  </div>
                )}
              </div>
            ) : edit ? (
              <ImageEditControls onUploaded={(url) => edit.onChange({ image_url: url })} />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-3xl bg-white text-slate-400 md:h-96">
                <p className="text-xs italic">Sin imagen cargada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/blocks/MethodologyBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx
git commit -m "feat(tasaciones): edición inline de texto e imagen en CoverBlock y MethodologyBlock"
```

---

### Task 6: Edición inline — CtaWhatsappBlock y AgentContactCardBlock

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/CtaWhatsappBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/AgentContactCardBlock.tsx`
- Test: extender `vendepro-frontend/src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`

**Interfaces:**
- Consumes: `InlineEditable`, `ImageEditControls`.
- Produces: mismo patrón `edit?: { onChange }` que Task 5, ahora en estos dos tipos.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `inline-structured-blocks.test.tsx`:

```tsx
import { CtaWhatsappBlock } from '../blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from '../blocks/AgentContactCardBlock'

describe('CtaWhatsappBlock — edición inline', () => {
  it('con edit, muestra los campos aunque no haya teléfono cargado, y commitea el texto', () => {
    const onChange = vi.fn()
    render(<CtaWhatsappBlock data={{}} edit={{ onChange }} />)
    const textEl = screen.getByText('¿Hablamos por WhatsApp?')
    textEl.textContent = 'Escribinos'
    fireEvent.blur(textEl)
    expect(onChange).toHaveBeenCalledWith({ text: 'Escribinos' })
  })

  it('sin edit y sin teléfono, no renderiza nada', () => {
    const { container } = render(<CtaWhatsappBlock data={{}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('AgentContactCardBlock — edición inline', () => {
  it('con edit, el nombre es contenteditable y commitea', () => {
    const onChange = vi.fn()
    render(<AgentContactCardBlock data={{ name: 'Marcela' }} appraisal={appraisal} edit={{ onChange }} />)
    const nameEl = screen.getByText('Marcela')
    nameEl.textContent = 'Marcela G.'
    fireEvent.blur(nameEl)
    expect(onChange).toHaveBeenCalledWith({ name: 'Marcela G.' })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: FAIL en los 3 tests nuevos (CtaWhatsapp no acepta `edit`, y hoy retorna `null` directamente si no hay `data.phone`, incluso en modo edición).

- [ ] **Step 3: Agregar `edit` a `CtaWhatsappBlock.tsx`**

Reemplazar el archivo completo:

```tsx
import { MessageCircle, ArrowRight } from 'lucide-react'
import { InlineEditable } from './InlineEditable'

interface Data { text?: string; phone?: string; pre_filled_message?: string; background_color?: string | null }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

export function CtaWhatsappBlock({ data, edit, ...attrs }: Props) {
  if (!edit && !data.phone) return null
  const cleaned = (data.phone ?? '').replace(/[^0-9]/g, '')
  const href = cleaned ? `https://wa.me/${cleaned}${data.pre_filled_message ? `?text=${encodeURIComponent(data.pre_filled_message)}` : ''}` : undefined

  return (
    <section {...attrs} className="px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-[#25D366] px-8 py-12 text-white shadow-lg md:px-16 md:py-16">
          <MessageCircle
            className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 opacity-15 md:-right-4 md:h-64 md:w-64"
            strokeWidth={1.5}
          />
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="w-full">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85 md:text-sm">
                Atención personalizada
              </p>
              {edit ? (
                <InlineEditable
                  as="p"
                  plaintext
                  value={data.text ?? ''}
                  placeholder="¿Hablamos por WhatsApp?"
                  className="mt-2 font-poppins text-2xl font-bold leading-tight md:text-4xl"
                  onCommit={(text) => edit.onChange({ text })}
                />
              ) : (
                <p className="mt-2 font-poppins text-2xl font-bold leading-tight md:text-4xl">
                  {data.text ?? '¿Hablamos por WhatsApp?'}
                </p>
              )}
              <p className="mt-2 text-sm text-white/85 md:text-base">
                Te respondemos en minutos, sin compromiso.
              </p>
              {edit && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl bg-white/10 p-3">
                  <label className="flex flex-col gap-1 text-xs text-white/85">
                    Teléfono (con código de país)
                    <input
                      type="tel"
                      defaultValue={data.phone ?? ''}
                      placeholder="5491158574005"
                      onBlur={(e) => edit.onChange({ phone: e.target.value.trim() })}
                      className="rounded px-2 py-1 text-sm text-slate-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-white/85">
                    Mensaje pre-cargado (opcional)
                    <input
                      type="text"
                      defaultValue={data.pre_filled_message ?? ''}
                      placeholder="Hola, me interesa la tasación de…"
                      onBlur={(e) => edit.onChange({ pre_filled_message: e.target.value })}
                      className="rounded px-2 py-1 text-sm text-slate-900"
                    />
                  </label>
                </div>
              )}
            </div>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (edit) e.preventDefault() }}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#25D366] shadow-sm transition-shadow hover:shadow-md md:px-8 md:py-4 md:text-base"
              >
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
                Abrir WhatsApp
                <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Agregar `edit` a `AgentContactCardBlock.tsx`**

Reemplazar el archivo completo:

```tsx
import { Phone, Mail, MessageCircle, User } from 'lucide-react'
import type { AppraisalContext } from '../types'
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface Data { avatar_url?: string | null; name?: string; phone?: string; email?: string; whatsapp_link?: string | null; background_color?: string | null }
interface Props {
  data: Data
  appraisal: AppraisalContext
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function AgentContactCardBlock({ data, appraisal, edit, ...attrs }: Props) {
  const agent = appraisal.agent
  const name = data.name ?? agent?.name
  const phone = data.phone ?? agent?.phone ?? undefined
  const email = data.email ?? agent?.email ?? undefined
  const avatar = data.avatar_url ?? agent?.avatar_url

  if (!edit && !name) return null

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Tu asesor
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          ¿Hablamos?
        </h2>

        <article className="mt-10 overflow-hidden rounded-3xl bg-[#f2f2f2] shadow-sm md:mt-12">
          <div className="grid grid-cols-1 md:grid-cols-5">
            <div
              className="relative flex items-center justify-center p-8 md:col-span-2 md:p-10"
              style={{ backgroundImage: BRAND_GRADIENT }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={name ?? ''}
                  className="h-32 w-32 rounded-full object-cover ring-4 ring-white/40 md:h-40 md:w-40"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/20 text-white md:h-40 md:w-40">
                  <User className="h-12 w-12 md:h-16 md:w-16" strokeWidth={1.5} />
                </div>
              )}
              {edit && (
                <div className="absolute bottom-2 right-2">
                  <ImageEditControls compact={!!avatar} onUploaded={(url) => edit.onChange({ avatar_url: url })} />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center p-8 md:col-span-3 md:p-12">
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--brand-color, #ff007c)' }}
              >
                Asesor inmobiliario
              </p>
              {edit ? (
                <InlineEditable
                  as="p"
                  plaintext
                  value={name ?? ''}
                  placeholder="Nombre del asesor"
                  className="mt-2 font-poppins text-2xl font-bold leading-tight text-slate-900 md:text-3xl"
                  onCommit={(v) => edit.onChange({ name: v })}
                />
              ) : (
                <p className="mt-2 font-poppins text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
                  {name}
                </p>
              )}

              <ul className="mt-6 space-y-3">
                {(edit || phone) && (
                  <li className="flex items-center gap-3 text-sm text-slate-700 md:text-base">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: 'var(--brand-color, #ff007c)' }}
                    >
                      <Phone className="h-4 w-4" />
                    </span>
                    {edit ? (
                      <input
                        type="tel"
                        defaultValue={phone ?? ''}
                        placeholder="Teléfono"
                        onBlur={(e) => edit.onChange({ phone: e.target.value.trim() })}
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
                    )}
                  </li>
                )}
                {(edit || email) && (
                  <li className="flex items-center gap-3 text-sm text-slate-700 md:text-base">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: 'var(--brand-color, #ff007c)' }}
                    >
                      <Mail className="h-4 w-4" />
                    </span>
                    {edit ? (
                      <input
                        type="email"
                        defaultValue={email ?? ''}
                        placeholder="Email"
                        onBlur={(e) => edit.onChange({ email: e.target.value.trim() })}
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      <a href={`mailto:${email}`} className="hover:underline">{email}</a>
                    )}
                  </li>
                )}
              </ul>

              {(edit || data.whatsapp_link) && !edit && data.whatsapp_link && (
                <a
                  href={data.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <MessageCircle className="h-4 w-4" />
                  Escribir por WhatsApp
                </a>
              )}
              {edit && (
                <label className="mt-6 flex flex-col gap-1 text-xs text-slate-500">
                  Link de WhatsApp (opcional)
                  <input
                    type="url"
                    defaultValue={data.whatsapp_link ?? ''}
                    placeholder="https://wa.me/…"
                    onBlur={(e) => edit.onChange({ whatsapp_link: e.target.value.trim() || null })}
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/renderer/blocks/CtaWhatsappBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/blocks/AgentContactCardBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx
git commit -m "feat(tasaciones): edición inline en CtaWhatsappBlock y AgentContactCardBlock"
```

---

### Task 7: Edición inline — ZoneMapBlock

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/blocks/ZoneMapBlock.tsx`
- Test: extender `inline-structured-blocks.test.tsx`

**Interfaces:**
- Consumes: `InlineEditable`, `ImageEditControls`.
- Produces: mismo patrón `edit?: { onChange }`, incluyendo los 4 campos numéricos como inputs simples (no contenteditable, por ser números).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `inline-structured-blocks.test.tsx`:

```tsx
import { ZoneMapBlock } from '../blocks/ZoneMapBlock'

describe('ZoneMapBlock — edición inline', () => {
  it('con edit, el título es contenteditable y los stats son inputs numéricos', () => {
    const onChange = vi.fn()
    render(<ZoneMapBlock data={{ title: 'Zona', avg_m2_price: 3000 }} edit={{ onChange }} />)
    const titleEl = screen.getByText('Zona')
    titleEl.textContent = 'Otra zona'
    fireEvent.blur(titleEl)
    expect(onChange).toHaveBeenCalledWith({ title: 'Otra zona' })

    const avgInput = screen.getByLabelText('Promedio USD/m²') as HTMLInputElement
    fireEvent.change(avgInput, { target: { value: '3500' } })
    fireEvent.blur(avgInput)
    expect(onChange).toHaveBeenCalledWith({ avg_m2_price: 3500 })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: FAIL — `ZoneMapBlock` no acepta `edit`.

- [ ] **Step 3: Agregar `edit` a `ZoneMapBlock.tsx`**

Reemplazar el archivo completo:

```tsx
import { MapPin, ImageIcon } from 'lucide-react'
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface Data {
  title?: string
  map_image_url?: string | null
  neighborhood_name?: string
  min_m2_price?: number
  avg_m2_price?: number
  median_m2_price?: number
  published_count?: number
  background_color?: string | null
}
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

const STAT_FIELDS: { key: 'min_m2_price' | 'avg_m2_price' | 'median_m2_price' | 'published_count'; label: string }[] = [
  { key: 'min_m2_price', label: 'Mínimo USD/m²' },
  { key: 'avg_m2_price', label: 'Promedio USD/m²' },
  { key: 'median_m2_price', label: 'Mediana USD/m²' },
  { key: 'published_count', label: 'Publicadas' },
]

export function ZoneMapBlock({ data, edit, ...attrs }: Props) {
  const stats = STAT_FIELDS
    .map(f => ({ ...f, value: data[f.key] }))
    .filter(s => edit || (s.value !== undefined && s.value !== null))

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          La zona
        </p>
        {edit ? (
          <InlineEditable
            as="h2"
            plaintext
            value={data.title ?? ''}
            placeholder="¿Qué está pasando en tu zona?"
            className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl"
            onCommit={(title) => edit.onChange({ title })}
          />
        ) : (
          <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
            {data.title ?? '¿Qué está pasando en tu zona?'}
          </h2>
        )}
        {edit ? (
          <InlineEditable
            as="p"
            plaintext
            value={data.neighborhood_name ?? ''}
            placeholder="Barrio o zona…"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:text-base"
            onCommit={(neighborhood_name) => edit.onChange({ neighborhood_name })}
          />
        ) : data.neighborhood_name ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:text-base">
            <MapPin className="h-4 w-4" style={{ color: 'var(--brand-color, #ff007c)' }} />
            {data.neighborhood_name}
          </p>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-12 md:grid-cols-2 md:gap-12">
          <div className="relative overflow-hidden rounded-3xl bg-[#f2f2f2]">
            {data.map_image_url ? (
              <img
                src={data.map_image_url}
                alt={data.neighborhood_name ?? 'Mapa de la zona'}
                className="h-full max-h-[420px] w-full object-cover"
              />
            ) : edit ? (
              <div className="p-6">
                <ImageEditControls onUploaded={(url) => edit.onChange({ map_image_url: url })} />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-slate-400 md:h-80">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-10 w-10" strokeWidth={1.5} />
                  <p className="mt-2 text-xs italic">Sin mapa cargado</p>
                </div>
              </div>
            )}
            {edit && data.map_image_url && (
              <div className="absolute right-2 top-2">
                <ImageEditControls compact onUploaded={(url) => edit.onChange({ map_image_url: url })} />
              </div>
            )}
          </div>

          {stats.length === 0 ? (
            <div className="flex items-center rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm italic text-slate-400">
              Sin estadísticas de zona cargadas todavía.
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-10 self-center">
              {stats.map(s => (
                <div key={s.key}>
                  {edit ? (
                    <label className="flex flex-col gap-1">
                      <input
                        type="number"
                        aria-label={s.label}
                        defaultValue={s.value ?? ''}
                        onBlur={(e) => edit.onChange({ [s.key]: e.target.value ? Number(e.target.value) : null })}
                        className="w-24 rounded border border-slate-300 px-2 py-1 font-poppins text-xl font-bold"
                      />
                    </label>
                  ) : (
                    <dd
                      className="font-poppins text-3xl font-bold leading-none md:text-4xl"
                      style={{ color: 'var(--brand-accent-color, #e17a2a)' }}
                    >
                      {s.value}
                    </dd>
                  )}
                  <dt className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div
          className="mx-auto mt-12 h-1 w-24 rounded-full md:mt-16"
          style={{ backgroundImage: BRAND_GRADIENT }}
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/renderer/blocks/ZoneMapBlock.tsx vendepro-frontend/src/components/tasaciones/renderer/__tests__/inline-structured-blocks.test.tsx
git commit -m "feat(tasaciones): edición inline de texto, imagen y stats en ZoneMapBlock"
```

---

### Task 8: Conectar los 5 tipos inline-editables al canvas

**Files:**
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/types.ts`
- Modify: `vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx`
- Test: extender `vendepro-frontend/src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`

**Interfaces:**
- Consumes: `CoverBlock`, `MethodologyBlock`, `CtaWhatsappBlock`, `AgentContactCardBlock`, `ZoneMapBlock` con su nuevo prop `edit` (Tasks 5-7).
- Produces: `INLINE_STRUCTURED_TYPES` (nuevo export de `renderer/types.ts`) — set de tipos que el canvas renderiza inline en vez de vía `BlockRenderer` de solo lectura. Cualquier bloque de estos 5 tipos deja de mostrar el botón "Editar campos"/popover para sus campos ya cubiertos inline (el popover sigue disponible para casos no cubiertos, ya que `BlockForm` soporta estos 5 tipos igual).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `EditableCanvas.test.tsx`:

```tsx
describe('EditableCanvas — bloques estructurados inline', () => {
  it('methodology (binding_mode system) edita el título inline y persiste vía onPatchOverride', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b1', type: 'methodology', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { title: 'Original' } }]
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={vi.fn()} onPatchOverride={onPatchOverride}
      />
    )
    const titleEl = screen.getByText('Original')
    titleEl.textContent = 'Editado'
    fireEvent.blur(titleEl)
    expect(onPatchOverride).toHaveBeenCalledWith('b1', { title: 'Editado' })
  })
})
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`
Expected: FAIL — `methodology` hoy se renderiza siempre de solo lectura vía `BlockRenderer` dentro de `EditableCanvas`.

- [ ] **Step 3: Agregar `INLINE_STRUCTURED_TYPES` a `renderer/types.ts`**

En `vendepro-frontend/src/components/tasaciones/renderer/types.ts`, después de la definición de `WEB_ONLY_TYPES` (línea 23-26), agregar:

```ts
/**
 * Tipos estructurados cuyos campos son escalares (texto simple / imagen /
 * número) y por eso se editan inline directo en el canvas, igual que los
 * bloques libres — no tienen arrays ni datos calculados de la tasación.
 */
export const INLINE_STRUCTURED_TYPES = new Set<AppraisalBlockType>([
  'cover', 'methodology', 'cta_whatsapp', 'agent_contact_card', 'zone_map',
])
```

- [ ] **Step 4: Wirear el render inline en `EditableCanvas.tsx`**

Importar los 5 componentes y el nuevo set en `EditableCanvas.tsx`:

```tsx
import { FREE_BLOCK_TYPES, INLINE_STRUCTURED_TYPES, WEB_ONLY_TYPES } from '../renderer/types'
import { CoverBlock } from '../renderer/blocks/CoverBlock'
import { MethodologyBlock } from '../renderer/blocks/MethodologyBlock'
import { CtaWhatsappBlock } from '../renderer/blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from '../renderer/blocks/AgentContactCardBlock'
import { ZoneMapBlock } from '../renderer/blocks/ZoneMapBlock'
```

En el `.map` principal de `EditableCanvas`, calcular un nuevo flag junto a `isFree`:

```tsx
            const isFree = FREE_BLOCK_TYPES.has(block.type)
            const isInlineStructured = INLINE_STRUCTURED_TYPES.has(block.type)
```

y en el render de `children` dentro de `<SortableBlock>`, agregar la tercera rama:

```tsx
                  {isFree
                    ? <EditableFreeBlock block={block} onChange={(patch) => onPatchData(block.id, patch)} />
                    : isInlineStructured
                      ? (h ? <EditableStructuredBlock block={h} appraisal={appraisal} onChange={(patch) => onPatchOverride(block.id, patch)} /> : null)
                      : (h ? <BlockRenderer block={h} mode={mode} appraisal={appraisal} /> : null)}
```

Y en el rail de controles de `SortableBlock`, el candado "template" (línea `{!isFree && (...)}`) debe seguir mostrándose para estos 5 tipos también (siguen siendo bloques del template) — no requiere cambios, ya que ese condicional usa `isFree`, no `isInlineStructured`. El botón "Editar campos"/popover (Task 4) también sigue disponible para estos 5 tipos sin cambios (`!isFree` incluye a los inline-editables) — les da acceso al popover para cualquier campo no cubierto inline.

Agregar el nuevo componente `EditableStructuredBlock` junto a `EditableFreeBlock`:

```tsx
function EditableStructuredBlock({
  block, appraisal, onChange,
}: {
  block: HydratedBlock
  appraisal: AppraisalContext
  onChange: (patch: Record<string, unknown>) => void
}) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data as any
  const edit = { onChange }
  let content: React.ReactNode
  switch (block.type) {
    case 'cover': content = <CoverBlock data={data} appraisal={appraisal} edit={edit} {...attrs} />; break
    case 'methodology': content = <MethodologyBlock data={data} edit={edit} {...attrs} />; break
    case 'cta_whatsapp': content = <CtaWhatsappBlock data={data} edit={edit} {...attrs} />; break
    case 'agent_contact_card': content = <AgentContactCardBlock data={data} appraisal={appraisal} edit={edit} {...attrs} />; break
    case 'zone_map': content = <ZoneMapBlock data={data} edit={edit} {...attrs} />; break
    default: return null
  }
  return data.background_color ? <div style={{ backgroundColor: data.background_color }}>{content}</div> : content
}
```

Este componente necesita `HydratedBlock` en el `import type` ya existente de `../renderer/types` (línea 17 del archivo original). Cambiar:

```tsx
import type { AppraisalBlockType, AppraisalContext, BlockOverrides, RenderMode, TemplateBlock } from '../renderer/types'
```

por:

```tsx
import type { AppraisalBlockType, AppraisalContext, BlockOverrides, HydratedBlock, RenderMode, TemplateBlock } from '../renderer/types'
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vendepro-frontend/src/components/tasaciones/renderer/types.ts vendepro-frontend/src/components/tasaciones/editor/EditableCanvas.tsx vendepro-frontend/src/components/tasaciones/editor/__tests__/EditableCanvas.test.tsx
git commit -m "feat(tasaciones): renderizar cover/methodology/cta_whatsapp/agent_contact_card/zone_map inline en el canvas"
```

---

### Task 9: Verificación final — suite completa + smoke manual

**Files:**
- No crea ni modifica archivos de producto — solo corre y confirma.

- [ ] **Step 1: Correr toda la suite de tests de tasaciones**

Run: `cd vendepro-frontend && npx vitest run src/components/tasaciones`
Expected: PASS — todos los tests de Tasks 1-8 más los preexistentes (`block-completeness.test.ts`, `blocks-smoke.test.tsx`, `hydrate-blocks.test.ts`).

- [ ] **Step 2: Typecheck**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a los archivos tocados (Cover/Methodology/CtaWhatsapp/AgentContactCard/ZoneMap Block, BlockRenderer, BlockForm, EditableCanvas, EditorShell, NotaryChartsForm, BlockEditPopover, types.ts).

- [ ] **Step 3: Smoke manual en el editor de una tasación real**

Levantar el dev server (`npm run dev` en `vendepro-frontend/`), abrir `/tasaciones/[id]/editar` de una tasación existente que use un template con bloques `system`/`org-static` (ej. metodología, portada, WhatsApp), y verificar a mano:
1. Click en el título de portada → se edita inline → aparece "Guardando..." → "Guardado" en el header.
2. Recargar la página → el cambio persiste (confirma que el PATCH de override se guardó).
3. Abrir la landing pública `/t/[slug]` en otra pestaña → el cambio se ve ahí también.
4. Click en el botón de color de fondo de un bloque (ej. "FODA") → elegir un color → el fondo cambia en el preview inmediatamente.
5. Click en "Editar campos" de un bloque con lista (ej. "Nuestros servicios") → se abre el popover anclado, no el panel lateral → agregar un servicio → se refleja en el preview sin cerrar el popover.
6. Modo `Print` (botón arriba del preview) → confirmar que el color de fondo also se ve ahí (usa el mismo `TemplateRenderer`/`BlockRenderer`).

Si algún paso falla, es un bug a resolver antes de considerar el plan completo — no lo omitas.

- [ ] **Step 4: Commit final (si hubo ajustes del smoke manual)**

Si el Step 3 no requirió cambios, no hay nada que commitear en este task — los commits ya ocurrieron en Tasks 1-8.
