# Tasaciones Templates — Sub-plan 2: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** No per-task commits. One final commit at the end after all tasks pass (user preference).
>
> **Subagent model:** Dispatch subagents with Sonnet (not Haiku).

**Goal:** Build the frontend for the tasaciones templates feature — renderer (16 block types + hydration client-side), new wizard with template selection, editor with in-place live preview + autosave, and complete admin UI (templates + variables + general config). Legacy compat via runtime switch in `/t/[slug]`.

**Architecture:** Monolith-per-feature under `src/components/tasaciones/` with subcarpetas (renderer/ wizard/ editor/ admin/ legacy/ shared/). Renderer is the reusable core consumed by 4 surfaces. Desktop-first for creation; mobile-first for public landing. Preview is in-place (not iframe) + "Ver pública" button opens `/t/[slug]` in a new tab.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind, lucide-react icons, @dnd-kit/sortable for drag-drop in admin, vitest + @testing-library/react for unit tests, MSW optional for integration tests.

**Spec reference:** `docs/superpowers/specs/2026-04-24-tasaciones-templates-frontend-design.md`

**Cross-cutting rules:**
- Cast `(await res.json()) as any` on every apiFetch response (CLAUDE.md rule).
- `'use client'` directive only where hooks/interactivity are used; default Server Component.
- Import from `lucide-react` by specific icon name (no barrel imports).
- Every fetch-driven screen must handle loading / empty / error states.
- Reuse existing components when possible: `<PropertySelector/>`, `<ImageUpload/>` from `components/landings/`, `useToast()`, `apiFetch()`.

---

## Phase A — Renderer foundation

Build the core `<TemplateRenderer/>` + `<BlockRenderer/>` + hydration + 5 foundational block types. After this phase, rendering works in tests (unit) but is not yet mounted in any page.

### Task 1: Create shared types file

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/types.ts`

- [ ] **Step 1: Write the types file**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/types.ts`:

```typescript
// TIPOS SINCRONIZADOS MANUALMENTE con vendepro-backend/packages/core/src/domain.
// Si cambia el backend (AppraisalBlockType, BindingMode, TemplateBlock shape),
// actualizar este archivo. Los tests de hydrate-blocks validan el contrato.

export type BindingMode = 'system' | 'org-static' | 'org-variable' | 'tasacion' | 'default-override'

export const APPRAISAL_BLOCK_TYPES = [
  'cover', 'proposal_commercial', 'services_grid', 'market_stats', 'funnel_chart',
  'methodology', 'notary_charts', 'property_data', 'swot', 'zone_map',
  'comparables_list', 'price_projection', 'work_conditions',
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
] as const

export type AppraisalBlockType = typeof APPRAISAL_BLOCK_TYPES[number]

export const WEB_ONLY_TYPES = new Set<AppraisalBlockType>([
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
])

export const PAGE_BREAK_BEFORE = new Set<AppraisalBlockType>([
  'proposal_commercial', 'property_data', 'comparables_list', 'price_projection', 'work_conditions',
])

export interface TemplateBlock {
  id: string
  type: AppraisalBlockType
  binding_mode: BindingMode
  include_in_pdf: boolean
  sort_order: number
  data: Record<string, unknown>
}

export interface AppraisalComparable {
  id: string
  appraisal_id: string
  zonaprop_url: string | null
  address: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  sort_order: number
}

export interface AppraisalContext {
  id: string
  property_address: string
  neighborhood: string | null
  city: string | null
  property_type: string | null
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  weighted_area: number | null
  swot: {
    strengths: string | null
    weaknesses: string | null
    opportunities: string | null
    threats: string | null
  } | null
  prices: {
    suggested: number | null
    test: number | null
    expected_close: number | null
    usd_per_m2: number | null
  } | null
  comparables: AppraisalComparable[]
  agent: {
    name: string
    phone: string | null
    email: string | null
    avatar_url: string | null
  } | null
  org: {
    name: string
    logo_url: string | null
    brand_color: string | null
    brand_accent_color: string | null
  } | null
}

export type ResolvedVars = Record<string, { value: string; type: string }>
export type BlockOverrides = Record<string, Record<string, unknown>>

export interface HydratedBlock extends TemplateBlock {
  resolved_data: Record<string, unknown> & {
    vars_resolved?: Record<string, { value: string; type: string }>
  }
}

export type RenderMode = 'web' | 'print'
```

- [ ] **Step 2: Verify the file parses**

Run from `vendepro-frontend/`:
```bash
cd vendepro-frontend && npx tsc --noEmit src/components/tasaciones/renderer/types.ts 2>&1 | head -20
```

Expected: no errors (or only errors about lib files unrelated to this module).

---

### Task 2: Implement `hydrate-blocks.ts` with TDD

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/hydrate-blocks.ts`
- Create: `vendepro-frontend/src/components/tasaciones/renderer/__tests__/hydrate-blocks.test.ts`

- [ ] **Step 1: Write the failing test**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/__tests__/hydrate-blocks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hydrateBlocks } from '../hydrate-blocks'
import type { TemplateBlock, AppraisalContext } from '../types'

const baseAppraisal: AppraisalContext = {
  id: 'a1',
  property_address: 'Mistral 3224',
  neighborhood: 'Villa Urquiza',
  city: 'CABA',
  property_type: 'casa',
  covered_area: 185,
  total_area: 240,
  semi_area: 20,
  weighted_area: 200,
  swot: { strengths: 'S', weaknesses: 'W', opportunities: 'O', threats: 'T' },
  prices: { suggested: 450000, test: 470000, expected_close: 420000, usd_per_m2: 2432 },
  comparables: [],
  agent: { name: 'Marcela', phone: null, email: null, avatar_url: null },
  org: { name: 'MG', logo_url: null, brand_color: null, brand_accent_color: null },
}

describe('hydrateBlocks', () => {
  it('orders by sort_order asc', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b2', type: 'methodology', binding_mode: 'org-static', include_in_pdf: true, sort_order: 2, data: { body: 'M' } },
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'Hi' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out.map(b => b.id)).toEqual(['b1', 'b2'])
  })

  it('filters web-only when mode=print', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {} },
      { id: 'b2', type: 'cta_whatsapp', binding_mode: 'org-static', include_in_pdf: false, sort_order: 1, data: { text: 'Hola' } },
    ]
    const webOut = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    const printOut = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'print' })
    expect(webOut).toHaveLength(2)
    expect(printOut).toHaveLength(1)
    expect(printOut[0].id).toBe('b1')
  })

  it('resolves appraisal.swot source', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'swot', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.swot', title: 'FODA' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({ source: 'appraisal.swot', title: 'FODA', strengths: 'S', threats: 'T' })
  })

  it('resolves appraisal.* source with property fields', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'property_data', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.*' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({
      property_address: 'Mistral 3224',
      neighborhood: 'Villa Urquiza',
      covered_area: 185,
    })
  })

  it('resolves vars with vars_resolved map', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'market_stats', binding_mode: 'org-variable', include_in_pdf: true, sort_order: 0, data: { vars: ['market.on_sale', 'market.sold'] } },
    ]
    const resolvedVars = {
      'market.on_sale': { value: '111294', type: 'number' },
      'market.sold': { value: '7646', type: 'number' },
    }
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal: baseAppraisal, resolvedVars, mode: 'web' })
    expect(out[0].resolved_data.vars_resolved).toEqual(resolvedVars)
  })

  it('merges overrides shallow over resolved data', () => {
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'work_conditions', binding_mode: 'default-override', include_in_pdf: true, sort_order: 0, data: { honorarios_pct: 3, exclusividad_dias: 120 } },
    ]
    const overrides = { b1: { honorarios_pct: 2.5 } }
    const out = hydrateBlocks({ snapshot, overrides, appraisal: baseAppraisal, resolvedVars: {}, mode: 'web' })
    expect(out[0].resolved_data).toMatchObject({ honorarios_pct: 2.5, exclusividad_dias: 120 })
  })

  it('resolves comparables', () => {
    const appraisal = { ...baseAppraisal, comparables: [{ id: 'c1', appraisal_id: 'a1', zonaprop_url: null, address: 'X', total_area: 100, covered_area: 80, price: 300000, usd_per_m2: 3000, sort_order: 0 }] }
    const snapshot: TemplateBlock[] = [
      { id: 'b1', type: 'comparables_list', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { source: 'appraisal.comparables', variant: 'published' } },
    ]
    const out = hydrateBlocks({ snapshot, overrides: {}, appraisal, resolvedVars: {}, mode: 'web' })
    expect((out[0].resolved_data as any).comparables).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run from `vendepro-frontend/`:
```bash
npx vitest run src/components/tasaciones/renderer/__tests__/hydrate-blocks.test.ts 2>&1 | tail -20
```

Expected: FAIL — cannot find module `../hydrate-blocks`.

- [ ] **Step 3: Implement `hydrate-blocks.ts`**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/hydrate-blocks.ts`:

```typescript
import type {
  TemplateBlock, HydratedBlock, AppraisalContext,
  ResolvedVars, BlockOverrides, RenderMode,
} from './types'

export interface HydrateInput {
  snapshot: TemplateBlock[]
  overrides: BlockOverrides
  appraisal: AppraisalContext
  resolvedVars: ResolvedVars
  mode: RenderMode
}

export function hydrateBlocks(input: HydrateInput): HydratedBlock[] {
  const filtered = (input.mode === 'print')
    ? input.snapshot.filter(b => b.include_in_pdf !== false)
    : [...input.snapshot]

  const sorted = [...filtered].sort((a, b) => a.sort_order - b.sort_order)

  return sorted.map(block => {
    const resolved: Record<string, unknown> = { ...block.data }

    const data = block.data as Record<string, unknown>
    const source = data.source as string | undefined

    if (source === 'appraisal.swot' && input.appraisal.swot) {
      Object.assign(resolved, input.appraisal.swot)
    }
    if (source === 'appraisal.prices' && input.appraisal.prices) {
      Object.assign(resolved, input.appraisal.prices)
    }
    if (source === 'appraisal.*') {
      Object.assign(resolved, {
        property_address: input.appraisal.property_address,
        neighborhood: input.appraisal.neighborhood,
        city: input.appraisal.city,
        property_type: input.appraisal.property_type,
        covered_area: input.appraisal.covered_area,
        total_area: input.appraisal.total_area,
        semi_area: input.appraisal.semi_area,
        weighted_area: input.appraisal.weighted_area,
      })
    }
    if (source === 'appraisal.comparables') {
      ;(resolved as any).comparables = input.appraisal.comparables
    }

    const varsArr = Array.isArray(data.vars) ? (data.vars as string[]) : []
    const chartVars = [data.chart_1_var, data.chart_2_var].filter(Boolean) as string[]
    const allRefs = [...varsArr, ...chartVars]
    if (allRefs.length) {
      const out: Record<string, { value: string; type: string }> = {}
      for (const k of allRefs) {
        const v = input.resolvedVars[k]
        if (v) out[k] = v
      }
      ;(resolved as any).vars_resolved = out
    }

    const ov = input.overrides[block.id]
    const finalData = ov ? { ...resolved, ...ov } : resolved

    return { ...block, resolved_data: finalData }
  })
}
```

- [ ] **Step 4: Run test — expect PASS**

Run:
```bash
npx vitest run src/components/tasaciones/renderer/__tests__/hydrate-blocks.test.ts 2>&1 | tail -15
```

Expected: all 7 tests PASS.

---

### Task 3: Implement `<TemplateRenderer/>` and `<BlockRenderer/>` with a placeholder dispatch

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/block-utils.ts`
- Create: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/renderer/TemplateRenderer.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/UnknownBlock.tsx`

- [ ] **Step 1: Write `block-utils.ts` with data-attr helper**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/block-utils.ts`:

```typescript
import { WEB_ONLY_TYPES, PAGE_BREAK_BEFORE, type AppraisalBlockType } from './types'

export function blockDataAttrs(block: { id: string; type: AppraisalBlockType; include_in_pdf: boolean }) {
  return {
    'data-block': block.type,
    'data-block-id': block.id,
    'data-block-web-only': (!block.include_in_pdf || WEB_ONLY_TYPES.has(block.type)) ? 'true' : undefined,
    'data-block-page-break': PAGE_BREAK_BEFORE.has(block.type) ? 'true' : undefined,
  }
}
```

- [ ] **Step 2: Write `UnknownBlock.tsx` fallback**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/UnknownBlock.tsx`:

```typescript
interface Props {
  type: string
  [key: `data-${string}`]: string | undefined
}

export function UnknownBlock({ type, ...dataAttrs }: Props) {
  if (process.env.NODE_ENV !== 'production') {
    return (
      <section {...dataAttrs} className="my-6 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-sm text-amber-900">
        <strong>Bloque desconocido:</strong> {type}
      </section>
    )
  }
  return null
}
```

- [ ] **Step 3: Write `BlockRenderer.tsx` with placeholder dispatch**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`:

```typescript
import type { HydratedBlock, AppraisalContext, RenderMode } from './types'
import { blockDataAttrs } from './block-utils'
import { UnknownBlock } from './blocks/UnknownBlock'

interface Props {
  block: HydratedBlock
  mode: RenderMode
  appraisal: AppraisalContext
}

export function BlockRenderer({ block, mode, appraisal }: Props) {
  const attrs = blockDataAttrs(block)
  // Concrete block components wired in later tasks. Placeholder for now.
  return <UnknownBlock type={block.type} {...attrs} />
}
```

- [ ] **Step 4: Write `TemplateRenderer.tsx`**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/TemplateRenderer.tsx`:

```typescript
'use client'

import { useMemo } from 'react'
import { BlockRenderer } from './BlockRenderer'
import { hydrateBlocks } from './hydrate-blocks'
import type {
  TemplateBlock, BlockOverrides, AppraisalContext,
  ResolvedVars, RenderMode,
} from './types'

interface Props {
  snapshot: TemplateBlock[]
  overrides?: BlockOverrides
  appraisal: AppraisalContext
  resolvedVars?: ResolvedVars
  mode?: RenderMode
  className?: string
}

export function TemplateRenderer({
  snapshot, overrides = {}, appraisal, resolvedVars = {}, mode = 'web', className,
}: Props) {
  const hydrated = useMemo(
    () => hydrateBlocks({ snapshot, overrides, appraisal, resolvedVars, mode }),
    [snapshot, overrides, appraisal, resolvedVars, mode],
  )

  const brandStyle = appraisal.org?.brand_color
    ? ({ '--brand-color': appraisal.org.brand_color } as React.CSSProperties)
    : undefined

  return (
    <div
      className={className}
      style={brandStyle}
      data-force-print={mode === 'print' ? 'true' : undefined}
    >
      {hydrated.map(block => (
        <BlockRenderer key={block.id} block={block} mode={mode} appraisal={appraisal} />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Verify typecheck passes**

Run from `vendepro-frontend/`:
```bash
npx tsc --noEmit 2>&1 | grep -E "tasaciones/renderer" | head -10
```

Expected: no errors in the 4 new files.

---

### Task 4: Add print.css

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/print.css`

- [ ] **Step 1: Write the CSS file**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/print.css`:

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
[data-force-print="true"] [data-block-page-break="true"] { break-before: page; page-break-before: always; }
[data-force-print="true"] .no-print { display: none !important; }

@page { size: A4; margin: 12mm; }
```

---

### Task 5: CoverBlock

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx`

- [ ] **Step 1: Implement the block**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/CoverBlock.tsx`:

```typescript
import type { AppraisalContext } from '../types'

interface CoverData {
  title?: string
  subtitle?: string
  cover_image_url?: string | null
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
  return (
    <section
      {...attrs}
      className="relative min-h-[80vh] flex items-end bg-gradient-to-br from-[var(--brand-color,#ff007c)] to-[#ff8017] text-white px-6 py-16 md:min-h-screen md:px-12"
    >
      {data.cover_image_url && (
        <img src={data.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      <div className="relative z-10 max-w-3xl">
        <h1 className="font-poppins text-4xl font-bold leading-tight md:text-6xl">
          {data.title ?? '¿Querés saber cuánto vale tu propiedad?'}
        </h1>
        {data.subtitle && <p className="mt-3 text-lg opacity-90 md:text-xl">{data.subtitle}</p>}
        <p className="mt-6 text-sm opacity-90 md:text-base">
          {appraisal.property_address}
          {appraisal.neighborhood ? ` · ${appraisal.neighborhood}` : ''}
        </p>
        {agent?.name && (
          <div className="mt-8 flex items-center gap-3">
            {agent.avatar_url && <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
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

- [ ] **Step 2: Wire into BlockRenderer**

Edit `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx` — replace the body with:

```typescript
import type { HydratedBlock, AppraisalContext, RenderMode } from './types'
import { blockDataAttrs } from './block-utils'
import { UnknownBlock } from './blocks/UnknownBlock'
import { CoverBlock } from './blocks/CoverBlock'

interface Props {
  block: HydratedBlock
  mode: RenderMode
  appraisal: AppraisalContext
}

export function BlockRenderer({ block, mode, appraisal }: Props) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data
  switch (block.type) {
    case 'cover':
      return <CoverBlock data={data as any} appraisal={appraisal} {...attrs} />
    default:
      return <UnknownBlock type={block.type} {...attrs} />
  }
}
```

---

### Task 6: PropertyDataBlock

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/PropertyDataBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`

- [ ] **Step 1: Implement the block**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/PropertyDataBlock.tsx`:

```typescript
interface PropertyData {
  title?: string
  property_address?: string
  neighborhood?: string | null
  city?: string | null
  property_type?: string | null
  covered_area?: number | null
  total_area?: number | null
  semi_area?: number | null
  weighted_area?: number | null
}

interface Props {
  data: PropertyData
  [key: `data-${string}`]: string | undefined
}

export function PropertyDataBlock({ data, ...attrs }: Props) {
  const rows: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Dirección', value: data.property_address },
    { label: 'Barrio', value: data.neighborhood },
    { label: 'Ciudad', value: data.city },
    { label: 'Tipología', value: data.property_type },
    { label: 'Superficie cubierta (m²)', value: data.covered_area },
    { label: 'Superficie total (m²)', value: data.total_area },
    { label: 'Semicubierta (m²)', value: data.semi_area },
    { label: 'Ponderada (m²)', value: data.weighted_area },
  ]
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos de la propiedad'}</h2>
      <dl className="mt-6 grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-8">
        {rows.filter(r => r.value !== null && r.value !== undefined && r.value !== '').map(r => (
          <div key={r.label} className="flex justify-between border-b border-slate-200 py-2">
            <dt className="text-sm text-slate-600">{r.label}</dt>
            <dd className="text-sm font-semibold text-slate-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
```

- [ ] **Step 2: Wire into BlockRenderer**

Edit the `switch` in `BlockRenderer.tsx` to add:

```typescript
case 'property_data':
  return <PropertyDataBlock data={data as any} {...attrs} />
```

And add the import at the top:
```typescript
import { PropertyDataBlock } from './blocks/PropertyDataBlock'
```

---

### Task 7: SwotBlock

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/SwotBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`

- [ ] **Step 1: Implement the block**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/SwotBlock.tsx`:

```typescript
interface SwotData {
  title?: string
  strengths?: string | null
  weaknesses?: string | null
  opportunities?: string | null
  threats?: string | null
}

interface Props {
  data: SwotData
  [key: `data-${string}`]: string | undefined
}

const QUADRANTS: { key: keyof SwotData; label: string; bg: string; border: string }[] = [
  { key: 'strengths', label: 'Fortalezas', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  { key: 'weaknesses', label: 'Debilidades', bg: 'bg-rose-50', border: 'border-rose-300' },
  { key: 'opportunities', label: 'Oportunidades', bg: 'bg-sky-50', border: 'border-sky-300' },
  { key: 'threats', label: 'Amenazas', bg: 'bg-amber-50', border: 'border-amber-300' },
]

export function SwotBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'FODA'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUADRANTS.map(q => {
          const value = data[q.key] as string | null | undefined
          if (!value) return null
          return (
            <div key={q.key} className={`rounded-lg border ${q.border} ${q.bg} p-4`}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{q.label}</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-900">{value}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into BlockRenderer**

Add import and case:
```typescript
import { SwotBlock } from './blocks/SwotBlock'
// ... in switch
case 'swot':
  return <SwotBlock data={data as any} {...attrs} />
```

---

### Task 8: WorkConditionsBlock

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/WorkConditionsBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`

- [ ] **Step 1: Implement the block**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/WorkConditionsBlock.tsx`:

```typescript
interface WorkConditionsData {
  title?: string
  honorarios_pct?: number
  exclusividad_dias?: number
  required_docs?: string[]
  extras?: string[]
  legal_text?: string
  signature_image_url?: string | null
}

interface Props {
  data: WorkConditionsData
  [key: `data-${string}`]: string | undefined
}

export function WorkConditionsBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Condiciones de trabajo'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Honorarios</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{data.honorarios_pct ?? 3}%</p>
          <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">Exclusividad</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.exclusividad_dias ?? 120} días</p>
        </div>
        <div>
          {data.required_docs && data.required_docs.length > 0 && (
            <>
              <p className="text-sm font-semibold text-slate-700">Documentación requerida</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {data.required_docs.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
          {data.extras && data.extras.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold text-slate-700">Adicionales</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {data.extras.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
      {data.legal_text && (
        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">{data.legal_text}</p>
      )}
      {data.signature_image_url && (
        <img src={data.signature_image_url} alt="Firma" className="mt-6 h-16 w-auto" />
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire into BlockRenderer**

```typescript
import { WorkConditionsBlock } from './blocks/WorkConditionsBlock'
// ...
case 'work_conditions':
  return <WorkConditionsBlock data={data as any} {...attrs} />
```

---

### Task 9: ComparablesListBlock

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/renderer/blocks/ComparablesListBlock.tsx`
- Modify: `vendepro-frontend/src/components/tasaciones/renderer/BlockRenderer.tsx`

- [ ] **Step 1: Implement the block**

Use Write tool to create `vendepro-frontend/src/components/tasaciones/renderer/blocks/ComparablesListBlock.tsx`:

```typescript
import type { AppraisalComparable } from '../types'

interface ComparablesData {
  title?: string
  variant?: 'published' | 'reserved'
  comparables?: AppraisalComparable[]
}

interface Props {
  data: ComparablesData
  [key: `data-${string}`]: string | undefined
}

function money(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function ComparablesListBlock({ data, ...attrs }: Props) {
  const list = data.comparables ?? []
  if (list.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Propiedades comparables'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map(c => (
          <article key={c.id} className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{c.address ?? 'Sin dirección'}</p>
            <dl className="mt-3 space-y-1 text-xs text-slate-600">
              {c.total_area !== null && <div className="flex justify-between"><dt>Superficie</dt><dd>{c.total_area} m²</dd></div>}
              {c.covered_area !== null && <div className="flex justify-between"><dt>Cubierta</dt><dd>{c.covered_area} m²</dd></div>}
              <div className="flex justify-between font-semibold text-slate-900"><dt>Precio</dt><dd>{money(c.price)}</dd></div>
              {c.usd_per_m2 !== null && <div className="flex justify-between"><dt>USD/m²</dt><dd>{c.usd_per_m2}</dd></div>}
            </dl>
            {c.zonaprop_url && (
              <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-xs text-[var(--brand-color,#ff007c)] hover:underline">
                Ver publicación ↗
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into BlockRenderer**

```typescript
import { ComparablesListBlock } from './blocks/ComparablesListBlock'
// ...
case 'comparables_list':
  return <ComparablesListBlock data={data as any} {...attrs} />
```

- [ ] **Step 3: Verify typecheck**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "tasaciones/renderer" | head
```

Expected: no errors.

---

## Phase B — Remaining 12 blocks

Each block is self-contained: one file in `renderer/blocks/`, one `case` added to `BlockRenderer.tsx`. Blocks are mobile-first (Tailwind `md:`, `lg:` for wider layouts).

### Task 10: ProposalCommercialBlock

**Files:** Create `renderer/blocks/ProposalCommercialBlock.tsx` + wire into `BlockRenderer.tsx`.

- [ ] **Step 1: Write the block**

```typescript
interface ProposalItem { icon?: string; title: string; body: string }
interface Data { title?: string; subtitle?: string; items?: ProposalItem[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ProposalCommercialBlock({ data, ...attrs }: Props) {
  const items = data.items ?? []
  return (
    <section {...attrs} className="bg-slate-50 px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Propuesta comercial'}</h2>
      {data.subtitle && <p className="mt-2 text-sm text-slate-600 md:text-base">{data.subtitle}</p>}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-lg bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--brand-color,#ff007c)]">{it.title}</h3>
            <p className="mt-2 text-sm text-slate-700">{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire into BlockRenderer**

Add import + `case 'proposal_commercial': return <ProposalCommercialBlock data={data as any} {...attrs} />`.

---

### Task 11: ServicesGridBlock

**Files:** Create `renderer/blocks/ServicesGridBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Service { icon?: string; label: string }
interface Data { title?: string; services?: Service[]; portals_logos?: string[]; badge_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ServicesGridBlock({ data, ...attrs }: Props) {
  const services = data.services ?? []
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Nuestros servicios'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {services.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-4 text-center">
            <p className="text-sm font-medium text-slate-800">{s.label}</p>
          </div>
        ))}
      </div>
      {data.badge_text && (
        <p className="mt-6 inline-block rounded-full bg-[var(--brand-color,#ff007c)] px-4 py-1 text-sm font-semibold text-white">
          {data.badge_text}
        </p>
      )}
      {data.portals_logos && data.portals_logos.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-6">
          {data.portals_logos.map((url, i) => <img key={i} src={url} alt="" className="h-8 w-auto opacity-80" />)}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `services_grid`.

---

### Task 12: MarketStatsBlock

**Files:** Create `renderer/blocks/MarketStatsBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data {
  title?: string
  vars?: string[]
  vars_resolved?: Record<string, { value: string; type: string }>
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function formatVar(v: { value: string; type: string }): string {
  if (v.type === 'number') return new Intl.NumberFormat('es-AR').format(Number(v.value))
  if (v.type === 'percent') return `${v.value}%`
  return v.value
}

export function MarketStatsBlock({ data, ...attrs }: Props) {
  const vars = data.vars ?? []
  const resolved = data.vars_resolved ?? {}
  return (
    <section {...attrs} className="bg-slate-900 px-6 py-10 text-white md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos del mercado'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {vars.map(key => {
          const v = resolved[key]
          const displayKey = key.split('.').pop()?.replace(/_/g, ' ') ?? key
          return (
            <div key={key} className="rounded-lg bg-slate-800 p-5">
              <p className="text-3xl font-bold">{v ? formatVar(v) : <span className="text-amber-400">{`{{${key}}}`}</span>}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{displayKey}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `market_stats`.

---

### Task 13: FunnelChartBlock

**Files:** Create `renderer/blocks/FunnelChartBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface FunnelItem { label: string; value: number }
interface Range { label: string; from: number; to: number; color?: string }
interface Data { title?: string; funnel?: FunnelItem[]; ranges?: Range[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function FunnelChartBlock({ data, ...attrs }: Props) {
  const items = data.funnel ?? []
  const max = items.reduce((m, i) => Math.max(m, i.value), 0) || 1
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? '¿Por qué las visualizaciones importan?'}</h2>
      <div className="mt-6 space-y-2">
        {items.map((it, i) => {
          const pct = (it.value / max) * 100
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-32 flex-shrink-0 text-sm text-slate-600">{it.label}</span>
              <div className="h-8 flex-1 rounded bg-slate-100">
                <div className="h-full rounded bg-[var(--brand-color,#ff007c)] text-right" style={{ width: `${pct}%` }}>
                  <span className="pr-2 text-sm font-semibold leading-8 text-white">{it.value}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {data.ranges && data.ranges.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {data.ranges.map((r, i) => (
            <span key={i} className="rounded-full px-3 py-1 text-white" style={{ background: r.color ?? '#64748b' }}>{r.label}</span>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `funnel_chart`.

---

### Task 14: MethodologyBlock

**Files:** Create `renderer/blocks/MethodologyBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data { title?: string; body?: string; image_url?: string | null; highlight_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function MethodologyBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-slate-50 px-6 py-10 md:px-12 md:py-16">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Nuestra metodología'}</h2>
          {data.body && <p className="mt-4 whitespace-pre-line text-sm text-slate-700 md:text-base">{data.body}</p>}
          {data.highlight_text && (
            <p className="mt-6 border-l-4 border-[var(--brand-color,#ff007c)] bg-white px-4 py-3 text-lg font-semibold italic text-slate-900">
              {data.highlight_text}
            </p>
          )}
        </div>
        {data.image_url && <img src={data.image_url} alt="" className="w-full rounded-lg object-cover" />}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `methodology`.

---

### Task 15: NotaryChartsBlock

**Files:** Create `renderer/blocks/NotaryChartsBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data {
  title?: string
  chart_1_var?: string
  chart_2_var?: string
  vars_resolved?: Record<string, { value: string; type: string }>
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function NotaryChartsBlock({ data, ...attrs }: Props) {
  const resolved = data.vars_resolved ?? {}
  const c1 = data.chart_1_var ? resolved[data.chart_1_var] : undefined
  const c2 = data.chart_2_var ? resolved[data.chart_2_var] : undefined
  const renderChart = (v: typeof c1, key?: string) => {
    if (!v) return <span className="text-amber-500">{`{{${key ?? 'chart'}}}`}</span>
    if (v.type === 'image_url') return <img src={v.value} alt="" className="w-full rounded-lg" />
    return <p>{v.value}</p>
  }
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos del Colegio de Escribanos'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>{renderChart(c1, data.chart_1_var)}</div>
        <div>{renderChart(c2, data.chart_2_var)}</div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `notary_charts`.

---

### Task 16: ZoneMapBlock

**Files:** Create `renderer/blocks/ZoneMapBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data {
  title?: string
  map_image_url?: string | null
  neighborhood_name?: string
  min_m2_price?: number
  avg_m2_price?: number
  median_m2_price?: number
  published_count?: number
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ZoneMapBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? '¿Qué está pasando en tu zona?'}</h2>
      {data.neighborhood_name && <p className="mt-2 text-sm text-slate-600">{data.neighborhood_name}</p>}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {data.map_image_url && <img src={data.map_image_url} alt="" className="w-full rounded-lg" />}
        <div className="space-y-3">
          {data.min_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Mínimo USD/m²</span><span className="font-semibold">{data.min_m2_price}</span></div>}
          {data.avg_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Promedio USD/m²</span><span className="font-semibold">{data.avg_m2_price}</span></div>}
          {data.median_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Mediana USD/m²</span><span className="font-semibold">{data.median_m2_price}</span></div>}
          {data.published_count !== undefined && <div className="flex justify-between border-b py-2"><span>Publicadas</span><span className="font-semibold">{data.published_count}</span></div>}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `zone_map`.

---

### Task 17: PriceProjectionBlock

**Files:** Create `renderer/blocks/PriceProjectionBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data {
  title?: string
  suggested?: number | null
  test?: number | null
  expected_close?: number | null
  usd_per_m2?: number | null
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function PriceProjectionBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-10 text-white md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Tasación proyectada'}</h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white/10 p-6">
          <p className="text-xs uppercase tracking-wide opacity-70">Publicación sugerida</p>
          <p className="mt-2 text-3xl font-bold">{money(data.suggested)}</p>
        </div>
        <div className="rounded-lg bg-white/10 p-6">
          <p className="text-xs uppercase tracking-wide opacity-70">Precio de prueba</p>
          <p className="mt-2 text-3xl font-bold">{money(data.test)}</p>
        </div>
        <div className="rounded-lg bg-[var(--brand-color,#ff007c)] p-6">
          <p className="text-xs uppercase tracking-wide opacity-90">Cierre esperado</p>
          <p className="mt-2 text-3xl font-bold">{money(data.expected_close)}</p>
        </div>
      </div>
      {data.usd_per_m2 && <p className="mt-6 text-sm opacity-80">USD/m²: {data.usd_per_m2}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `price_projection`.

---

### Task 18: VideoGalleryBlock (web-only)

**Files:** Create `renderer/blocks/VideoGalleryBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Video { url: string; caption?: string; provider: 'youtube' | 'vimeo' | 'r2' }
interface Data { title?: string; videos?: Video[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function embedUrl(v: Video): string {
  if (v.provider === 'youtube') {
    const id = v.url.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : v.url
  }
  if (v.provider === 'vimeo') {
    const id = v.url.match(/vimeo\.com\/(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : v.url
  }
  return v.url
}

export function VideoGalleryBlock({ data, ...attrs }: Props) {
  const videos = data.videos ?? []
  if (videos.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Videos'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {videos.map((v, i) => (
          <figure key={i}>
            {v.provider === 'r2' ? (
              <video src={v.url} controls className="w-full rounded-lg" />
            ) : (
              <iframe src={embedUrl(v)} className="aspect-video w-full rounded-lg" allowFullScreen />
            )}
            {v.caption && <figcaption className="mt-2 text-sm text-slate-600">{v.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `video_gallery`.

---

### Task 19: ExtraMediaBlock (web-only)

**Files:** Create `renderer/blocks/ExtraMediaBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Media { type: 'image' | 'video'; url: string; caption?: string }
interface Data { title?: string; media?: Media[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ExtraMediaBlock({ data, ...attrs }: Props) {
  const media = data.media ?? []
  if (media.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Galería'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {media.map((m, i) => (
          <figure key={i}>
            {m.type === 'image' ? (
              <img src={m.url} alt={m.caption ?? ''} className="aspect-square w-full rounded-lg object-cover" />
            ) : (
              <video src={m.url} controls className="aspect-square w-full rounded-lg object-cover" />
            )}
            {m.caption && <figcaption className="mt-1 text-xs text-slate-500">{m.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `extra_media`.

---

### Task 20: CtaWhatsappBlock (web-only)

**Files:** Create `renderer/blocks/CtaWhatsappBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
interface Data { text?: string; phone?: string; pre_filled_message?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function CtaWhatsappBlock({ data, ...attrs }: Props) {
  if (!data.phone) return null
  const cleaned = data.phone.replace(/[^0-9]/g, '')
  const href = `https://wa.me/${cleaned}${data.pre_filled_message ? `?text=${encodeURIComponent(data.pre_filled_message)}` : ''}`
  return (
    <section {...attrs} className="bg-[#25D366] px-6 py-8 text-white md:px-12 md:py-10">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <p className="text-lg font-semibold md:text-xl">{data.text ?? '¿Hablamos por WhatsApp?'}</p>
        <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-6 py-3 font-semibold text-[#25D366]">
          Abrir WhatsApp →
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire**

Add case `cta_whatsapp`.

---

### Task 21: AgentContactCardBlock (web-only)

**Files:** Create `renderer/blocks/AgentContactCardBlock.tsx` + wire.

- [ ] **Step 1: Write the block**

```typescript
import type { AppraisalContext } from '../types'

interface Data { avatar_url?: string | null; name?: string; phone?: string; email?: string; whatsapp_link?: string | null }
interface Props { data: Data; appraisal: AppraisalContext; [key: `data-${string}`]: string | undefined }

export function AgentContactCardBlock({ data, appraisal, ...attrs }: Props) {
  const agent = appraisal.agent
  const name = data.name ?? agent?.name
  const phone = data.phone ?? agent?.phone ?? undefined
  const email = data.email ?? agent?.email ?? undefined
  const avatar = data.avatar_url ?? agent?.avatar_url
  if (!name) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-slate-50 p-8 text-center">
        {avatar && <img src={avatar} alt="" className="h-24 w-24 rounded-full object-cover" />}
        <div>
          <p className="text-xl font-bold">{name}</p>
          {phone && <p className="mt-1 text-sm text-slate-600">{phone}</p>}
          {email && <p className="text-sm text-slate-600">{email}</p>}
        </div>
        {data.whatsapp_link && (
          <a href={data.whatsapp_link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white">
            WhatsApp
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Wire BlockRenderer — add all remaining cases + pass appraisal**

Edit `BlockRenderer.tsx` — import all 12 remaining blocks and add every `case` so the final switch covers all 17 types. The `agent_contact_card` case must pass `appraisal`:

```typescript
case 'agent_contact_card':
  return <AgentContactCardBlock data={data as any} appraisal={appraisal} {...attrs} />
```

- [ ] **Step 3: Verify typecheck clean for renderer/**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "tasaciones/renderer" | head
```

Expected: no errors.

- [ ] **Step 4: Add smoke tests for all 17 blocks**

Create `vendepro-frontend/src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TemplateRenderer } from '../TemplateRenderer'
import type { TemplateBlock, AppraisalContext } from '../types'
import { APPRAISAL_BLOCK_TYPES } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: 'Y', city: 'C', property_type: 'casa',
  covered_area: 100, total_area: 120, semi_area: 10, weighted_area: 110,
  swot: { strengths: 's', weaknesses: 'w', opportunities: 'o', threats: 't' },
  prices: { suggested: 300000, test: 320000, expected_close: 280000, usd_per_m2: 3000 },
  comparables: [{ id: 'c1', appraisal_id: 'a1', zonaprop_url: null, address: 'Z', total_area: 100, covered_area: 80, price: 300000, usd_per_m2: 3000, sort_order: 0 }],
  agent: { name: 'M', phone: '+5411', email: 'm@x.com', avatar_url: null },
  org: { name: 'MG', logo_url: null, brand_color: '#ff007c', brand_accent_color: null },
}

describe('blocks smoke tests', () => {
  for (const type of APPRAISAL_BLOCK_TYPES) {
    it(`renders ${type} without crashing`, () => {
      const block: TemplateBlock = {
        id: `b-${type}`, type, binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0,
        data: { title: 'T', phone: '+5411', videos: [], media: [], services: [{ label: 'S' }], items: [{ title: 'I', body: 'B' }], funnel: [{ label: 'A', value: 1 }] },
      }
      expect(() => render(<TemplateRenderer snapshot={[block]} appraisal={appraisal} />)).not.toThrow()
    })
  }
})
```

Run:
```bash
cd vendepro-frontend && npx vitest run src/components/tasaciones/renderer/__tests__/blocks-smoke.test.tsx 2>&1 | tail -10
```

Expected: 17 tests PASS.

---

## Phase C — Public `/t/[slug]` runtime switch

### Task 22: Move PublicAppraisalShell to `legacy/`

**Files:**
- Move: `vendepro-frontend/src/components/tasaciones/PublicAppraisalShell.tsx` → `legacy/PublicAppraisalShell.tsx`

- [ ] **Step 1: Move the file and update imports**

Run from repo root:
```bash
mkdir -p vendepro-frontend/src/components/tasaciones/legacy
git mv vendepro-frontend/src/components/tasaciones/PublicAppraisalShell.tsx vendepro-frontend/src/components/tasaciones/legacy/PublicAppraisalShell.tsx
```

- [ ] **Step 2: Update imports across codebase**

Grep for any import referencing the old path and update to `@/components/tasaciones/legacy/PublicAppraisalShell`.

Run:
```bash
cd vendepro-frontend && grep -rl "@/components/tasaciones/PublicAppraisalShell" src/ | xargs sed -i 's|@/components/tasaciones/PublicAppraisalShell|@/components/tasaciones/legacy/PublicAppraisalShell|g'
```

Verify:
```bash
grep -rn "PublicAppraisalShell" src/ | head
```

Expected: only imports from `legacy/PublicAppraisalShell` and the file itself.

---

### Task 23: Verify `/public/appraisal/:slug` returns `resolved_vars` (backend check)

**Files:**
- Read: `vendepro-backend/packages/api-public/src/**` (find the route handler for `/public/appraisal/:slug`)
- Possibly modify: the route handler to include `resolved_vars`

- [ ] **Step 1: Find the handler**

Run from repo root:
```bash
grep -rn "public/appraisal" vendepro-backend/packages/api-public/src 2>&1 | head -10
```

Read the handler and its use case response shape.

- [ ] **Step 2: Check if `resolved_vars` is computed**

Look for `OrgVariableRepository.resolveKeys` or similar being called in the public appraisal path. If present and returned — done, move to Task 24.

- [ ] **Step 3: If missing — add `resolved_vars` to response**

In the handler (and corresponding use case `GetPublicAppraisalUseCase` under `vendepro-backend/packages/core/src/application/use-cases/public/`):

- Load `template_snapshot_json` and scan blocks for `data.vars`, `data.chart_1_var`, `data.chart_2_var`.
- Inject `D1OrgVariableRepository` and call `.resolveKeys(orgId, Array.from(allKeys))`.
- Add `resolved_vars` at the top level of the response JSON (parallel to `appraisal`, `org`).

Verify response shape by hitting the endpoint locally:
```bash
curl -s http://localhost:8708/public/appraisal/<seed-slug> | jq '{ has_resolved_vars: (has("resolved_vars")), vars_count: (.resolved_vars | length) }'
```

Expected: `has_resolved_vars: true`.

(If backend changes are made, they'll be included in the final commit of this sub-plan — but keep the scope of the backend change minimal: just the new field.)

---

### Task 24: Modify `/t/[slug]/page.tsx` with runtime switch

**Files:**
- Modify: `vendepro-frontend/src/app/t/[slug]/page.tsx`

- [ ] **Step 1: Replace page body with switching logic**

Read the current file first (86 lines). Preserve `generateMetadata` as-is. Replace only the `export default async function PublicTasacionPage` body and imports.

Use Write tool (since the file is small, full rewrite is cleaner). New content:

```typescript
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicAppraisalShell from '@/components/tasaciones/legacy/PublicAppraisalShell'
import { TemplateRenderer } from '@/components/tasaciones/renderer/TemplateRenderer'
import type { AppraisalContext, TemplateBlock, BlockOverrides, ResolvedVars } from '@/components/tasaciones/renderer/types'
import GtmScript from '@/components/marketing/GtmScript'
import '@/components/tasaciones/renderer/print.css'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

function parseJson<T>(v: unknown): T | null {
  if (!v) return null
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return null } }
  return null
}

function buildAppraisalContext(data: any): AppraisalContext {
  const a = data.appraisal
  return {
    id: a.id,
    property_address: a.property_address,
    neighborhood: a.neighborhood ?? null,
    city: a.city ?? null,
    property_type: a.property_type ?? null,
    covered_area: a.covered_area ?? null,
    total_area: a.total_area ?? null,
    semi_area: a.semi_area ?? null,
    weighted_area: a.weighted_area ?? null,
    swot: {
      strengths: a.strengths ?? null,
      weaknesses: a.weaknesses ?? null,
      opportunities: a.opportunities ?? null,
      threats: a.threats ?? null,
    },
    prices: {
      suggested: a.suggested_price ?? null,
      test: a.test_price ?? null,
      expected_close: a.expected_close_price ?? null,
      usd_per_m2: a.usd_per_m2 ?? null,
    },
    comparables: a.comparables ?? [],
    agent: data.agent ?? null,
    org: data.org ?? data.branding ?? null,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Informe de tasación', robots: { index: false } }
    const data = (await res.json()) as any
    const appraisal = data?.appraisal
    if (!appraisal) return { title: 'Informe de tasación', robots: { index: false } }
    const org = data.org || data.branding || { name: 'Inmobiliaria' }
    return {
      title: `Tasación — ${appraisal.property_address}`,
      description: `Informe de tasación profesional para ${appraisal.property_address}. Preparado por ${org.name}.`,
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Informe de tasación', robots: { index: false } }
  }
}

export default async function PublicTasacionPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { slug } = await params
  const qp = await searchParams

  const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
  if (!res.ok) notFound()
  const data = (await res.json()) as any
  if (!data?.appraisal) notFound()

  const isPrint = qp?.print === '1'
  const snapshot = parseJson<TemplateBlock[]>(data.appraisal.template_snapshot_json)
  const hasTemplate = !!data.appraisal.template_id && snapshot !== null && snapshot.length > 0

  if (hasTemplate) {
    const overrides = parseJson<BlockOverrides>(data.appraisal.block_overrides_json) ?? {}
    const appraisal = buildAppraisalContext(data)
    const resolvedVars = (data.resolved_vars as ResolvedVars | undefined) ?? {}
    return (
      <>
        <TemplateRenderer
          snapshot={snapshot}
          overrides={overrides}
          appraisal={appraisal}
          resolvedVars={resolvedVars}
          mode={isPrint ? 'print' : 'web'}
          className="min-h-screen bg-white"
        />
        <GtmScript />
      </>
    )
  }

  return <PublicAppraisalShell data={data} />
}
```

- [ ] **Step 2: Typecheck and manual check**

Run:
```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "app/t/\[slug\]" | head
```

Expected: no errors.

- [ ] **Step 3: Manual check (dev server)**

Start dev servers (frontend + api-public local) and visit `/t/<slug-of-a-tasacion-with-template_id>` and `/t/<slug-of-a-legacy-tasacion>`. First should use `<TemplateRenderer/>`; second should fall through to `<PublicAppraisalShell/>`. Verify no console errors.

---

## Phase D — Wizard (`/tasaciones/nueva`)

### Task 25: `shared/api.ts` with tipped wrappers

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/shared/api.ts`

- [ ] **Step 1: Write wrappers**

See spec §10 for the list of endpoints. Create one function per operation: `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `duplicateTemplate`, `archiveTemplate`, `listVariables`, `createVariable`, `updateVariable`, `deleteVariable`, `getAppraisal`, `createAppraisal`, `updateAppraisal`, `publishAppraisal`, `syncTemplate`, `patchBlockOverride`, `addComparable`, `deleteComparable`.

Each function wraps `apiFetch` from `@/lib/api`. Cast the JSON response with `as any` (project rule). Example shape:

```typescript
import { apiFetch } from '@/lib/api'

export async function listTemplates(params?: { active?: boolean; kind?: string }): Promise<any[]> {
  const qs = new URLSearchParams()
  if (params?.active) qs.set('active', '1')
  if (params?.kind) qs.set('kind', params.kind)
  const r = await apiFetch(`/appraisal-templates${qs.size ? `?${qs}` : ''}`, {}, 'admin')
  return (await r.json()) as any
}

export async function createAppraisal(body: any): Promise<{ id: string; status: string }> {
  const r = await apiFetch(`/appraisals`, { method: 'POST', body: JSON.stringify(body) }, 'properties')
  return (await r.json()) as any
}

// ... follow the same pattern for each endpoint in spec §10
```

**NOTE:** the third argument (`'admin'`, `'properties'`, `'public'`) picks the API base URL. Read `src/lib/api.ts` to confirm the signature; adapt if needed. Keep the same set of calls.

- [ ] **Step 2: Typecheck**

```bash
cd vendepro-frontend && npx tsc --noEmit src/components/tasaciones/shared/api.ts 2>&1 | head
```

Expected: no errors.

---

### Task 26: `use-wizard-form.ts` hook

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/wizard/use-wizard-form.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client'
import { useReducer } from 'react'
import type { AppraisalComparable } from '../renderer/types'

export type WizardStep = 1 | 2 | 3 | 4

export interface WizardState {
  step: WizardStep
  template_id: string | null
  property: {
    address: string
    neighborhood?: string
    city?: string
    property_type?: string
    covered_area?: number | null
    total_area?: number | null
    semi_area?: number | null
    weighted_area?: number | null
  }
  lead_id: string | null
  details: {
    strengths?: string | null
    weaknesses?: string | null
    opportunities?: string | null
    threats?: string | null
    suggested_price?: number | null
    test_price?: number | null
    expected_close_price?: number | null
    usd_per_m2?: number | null
  }
  comparables: Omit<AppraisalComparable, 'id' | 'appraisal_id'>[]
  publish: { generate_public_slug: boolean }
}

type Action =
  | { type: 'next' } | { type: 'back' } | { type: 'goto'; step: WizardStep }
  | { type: 'set_template'; id: string | null }
  | { type: 'patch_property'; patch: Partial<WizardState['property']> }
  | { type: 'set_lead'; id: string | null }
  | { type: 'patch_details'; patch: Partial<WizardState['details']> }
  | { type: 'add_comparable'; comparable: WizardState['comparables'][number] }
  | { type: 'remove_comparable'; index: number }
  | { type: 'toggle_public_slug' }

export const initialState: WizardState = {
  step: 1, template_id: null, lead_id: null,
  property: { address: '' }, details: {}, comparables: [],
  publish: { generate_public_slug: true },
}

export function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'goto': return { ...state, step: action.step }
    case 'next': return { ...state, step: Math.min(4, state.step + 1) as WizardStep }
    case 'back': return { ...state, step: Math.max(1, state.step - 1) as WizardStep }
    case 'set_template': return { ...state, template_id: action.id }
    case 'patch_property': return { ...state, property: { ...state.property, ...action.patch } }
    case 'set_lead': return { ...state, lead_id: action.id }
    case 'patch_details': return { ...state, details: { ...state.details, ...action.patch } }
    case 'add_comparable': return { ...state, comparables: [...state.comparables, action.comparable] }
    case 'remove_comparable': return { ...state, comparables: state.comparables.filter((_, i) => i !== action.index) }
    case 'toggle_public_slug': return { ...state, publish: { generate_public_slug: !state.publish.generate_public_slug } }
    default: return state
  }
}

export function useWizardForm(init?: Partial<WizardState>) {
  return useReducer(wizardReducer, { ...initialState, ...init })
}

export function canAdvance(state: WizardState): boolean {
  if (state.step === 2) return state.property.address.trim().length > 0
  return true
}
```

---

### Task 27: Step components (StepTemplate / StepProperty / StepDetails / StepReview)

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/wizard/steps/StepTemplate.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/wizard/steps/StepProperty.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/wizard/steps/StepDetails.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/wizard/steps/StepReview.tsx`

Each step is a self-contained client component with props passed down from `WizardShell`. Implementation guidance:

**StepTemplate:** `useEffect` → `listTemplates({ active: true })`. Grid 1/3 cols with card per template + "Empezar de cero" card. Props: `{ selectedId, onSelect }`. Skeleton while loading (5 placeholder cards). Error with retry button.

**StepProperty:** controlled form with 9 fields: address (required), neighborhood, city, property_type (select from `casa/departamento/terreno/local/oficina/ph/otro`), 4 superficies (numbers, optional), lead (via `<PropertySelector kind="lead"/>` — existing component). Props: `{ property, leadId, onPatchProperty, onSetLead }`.

**StepDetails:** 3 sections (SWOT 4 textareas / Precios 4 number inputs / Comparables list with add-modal). Props: `{ details, comparables, onPatchDetails, onAddComparable, onRemoveComparable }`. Modal fields: address, zonaprop_url, total_area, covered_area, price, usd_per_m2.

**StepReview:** fetch template snapshot via `getTemplate(state.template_id)` if set, else empty snapshot. Build `AppraisalContext` from `WizardState` via helper `buildCtx(state)`. Render `<TemplateRenderer snapshot={...} appraisal={ctx} mode="web"/>`. Toggle "Generar link público" wired to `onTogglePublicSlug`. Handle template_id=null (empty template) with empty state message "Podrás agregar bloques desde el editor".

- [ ] **Step 1: Write all 4 step files**

Follow the guidance above. Use Tailwind. Imports: `lucide-react` (`Plus`, `X`, `ArrowLeft`, `ArrowRight`, `Loader2`, `AlertCircle`), `@/lib/api` (via shared/api.ts wrappers), `@/components/ui/PropertySelector` (existing).

- [ ] **Step 2: Typecheck**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "wizard/steps" | head
```

Expected: no errors.

---

### Task 28: `WizardShell.tsx` with stepper + publish flow

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/wizard/WizardShell.tsx`

- [ ] **Step 1: Write the shell**

Client component. Uses `useWizardForm()`. Renders:
- Header: "Nueva tasación" + cancel button (`router.back()`).
- Stepper: 4 pills, active=brand color, done=gray with checkmark.
- Current step body (switch on `state.step`).
- Footer: Back button (disabled on step 1) + Next button (disabled if `!canAdvance(state)`) OR Publish button on step 4.

Publish flow:
1. `createAppraisal({...})` — all wizard fields mapped.
2. For each comparable in state: `addComparable({ ...c, appraisal_id: id })`.
3. If `state.publish.generate_public_slug`: `publishAppraisal(id)`.
4. Redirect: `router.push(/tasaciones/${id}/editar?welcome=1)`.
5. Error path: toast error + stay on step 4.

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useWizardForm, canAdvance } from './use-wizard-form'
import { StepTemplate } from './steps/StepTemplate'
import { StepProperty } from './steps/StepProperty'
import { StepDetails } from './steps/StepDetails'
import { StepReview } from './steps/StepReview'
import { createAppraisal, publishAppraisal, addComparable } from '../shared/api'
import { useToast } from '@/components/ui/Toast'

interface Props { initialTemplateId?: string | null }
const STEP_LABELS = ['Template', 'Propiedad', 'FODA + Precios', 'Revisar']

export function WizardShell({ initialTemplateId }: Props) {
  const [state, dispatch] = useWizardForm({ template_id: initialTemplateId ?? null, step: initialTemplateId ? 2 : 1 })
  const [publishing, setPublishing] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const { id } = await createAppraisal({
        template_id: state.template_id,
        ...state.property,
        lead_id: state.lead_id,
        ...state.details,
      })
      for (const c of state.comparables) await addComparable({ ...c, appraisal_id: id })
      if (state.publish.generate_public_slug) await publishAppraisal(id)
      router.push(`/tasaciones/${id}/editar?welcome=1`)
    } catch (e: any) {
      toast({ type: 'error', message: e.message ?? 'Error al publicar' })
      setPublishing(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva tasación</h1>
        <button onClick={() => router.back()} className="text-sm text-slate-500">Cancelar</button>
      </header>
      <div className="mb-8 flex gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4
          const done = n < state.step
          const active = n === state.step
          return (
            <div key={i} className={`flex-1 rounded px-3 py-2 text-center text-xs font-medium ${active ? 'bg-[#ff007c] text-white' : done ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400'}`}>
              {done && '✓ '}{n}. {label}
            </div>
          )
        })}
      </div>
      <div className="min-h-[50vh]">
        {state.step === 1 && <StepTemplate selectedId={state.template_id} onSelect={id => dispatch({ type: 'set_template', id })} />}
        {state.step === 2 && <StepProperty property={state.property} leadId={state.lead_id} onPatchProperty={p => dispatch({ type: 'patch_property', patch: p })} onSetLead={id => dispatch({ type: 'set_lead', id })} />}
        {state.step === 3 && <StepDetails details={state.details} comparables={state.comparables} onPatchDetails={p => dispatch({ type: 'patch_details', patch: p })} onAddComparable={c => dispatch({ type: 'add_comparable', comparable: c })} onRemoveComparable={i => dispatch({ type: 'remove_comparable', index: i })} />}
        {state.step === 4 && <StepReview state={state} onTogglePublicSlug={() => dispatch({ type: 'toggle_public_slug' })} />}
      </div>
      <footer className="mt-8 flex justify-between border-t border-slate-200 pt-6">
        <button onClick={() => dispatch({ type: 'back' })} disabled={state.step === 1} className="flex items-center gap-2 rounded px-4 py-2 text-sm text-slate-600 disabled:opacity-40">
          <ArrowLeft className="h-4 w-4" /> Atrás
        </button>
        {state.step < 4 ? (
          <button onClick={() => dispatch({ type: 'next' })} disabled={!canAdvance(state)} className="flex items-center gap-2 rounded bg-[#ff007c] px-5 py-2 text-sm text-white disabled:opacity-40">
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handlePublish} disabled={publishing} className="flex items-center gap-2 rounded bg-[#ff007c] px-5 py-2 text-sm text-white disabled:opacity-40">
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.publish.generate_public_slug ? 'Publicar' : 'Guardar borrador'}
          </button>
        )}
      </footer>
    </div>
  )
}
```

---

### Task 29: Replace `/tasaciones/nueva/page.tsx` + delete legacy steps

**Files:**
- Modify (full rewrite): `vendepro-frontend/src/app/(dashboard)/tasaciones/nueva/page.tsx`
- Delete: legacy step files.

- [ ] **Step 1: Replace the page**

Use Write tool to overwrite with:

```typescript
import { WizardShell } from '@/components/tasaciones/wizard/WizardShell'

export default async function NuevaTasacionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>
}) {
  const qp = await searchParams
  return <WizardShell initialTemplateId={qp?.template ?? null} />
}
```

- [ ] **Step 2: Delete legacy step files**

```bash
git rm vendepro-frontend/src/components/tasaciones/steps/ProposalStep.tsx
git rm vendepro-frontend/src/components/tasaciones/steps/MarketSituationStep.tsx
git rm vendepro-frontend/src/components/tasaciones/steps/WorkConditionsStep.tsx
git rm vendepro-frontend/src/components/tasaciones/PreviewPane.tsx
git rm vendepro-frontend/src/components/tasaciones/wizardTypes.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "(tasaciones|nueva/page)" | head
```

Expected: no errors.

---

## Phase E — Editor (`/tasaciones/[id]/editar`)

### Task 30: `useEditorState.ts` reducer hook

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/useEditorState.ts`

- [ ] **Step 1: Write the reducer**

```typescript
'use client'
import { useReducer } from 'react'
import type { BlockOverrides } from '../renderer/types'

export interface EditorState {
  appraisal: any
  overrides: BlockOverrides
  dirty: boolean
  pendingPatches: {
    appraisal: Record<string, unknown>
    overrides: Record<string, Record<string, unknown>>
  }
}

type Action =
  | { type: 'init'; appraisal: any }
  | { type: 'patch_appraisal'; patch: Record<string, unknown> }
  | { type: 'patch_override'; blockId: string; patch: Record<string, unknown> }
  | { type: 'consume_pending' }

export function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'init':
      return {
        appraisal: action.appraisal,
        overrides: (typeof action.appraisal.block_overrides_json === 'string'
          ? (JSON.parse(action.appraisal.block_overrides_json) as BlockOverrides)
          : (action.appraisal.block_overrides_json ?? {})),
        dirty: false,
        pendingPatches: { appraisal: {}, overrides: {} },
      }
    case 'patch_appraisal':
      return {
        ...state,
        appraisal: { ...state.appraisal, ...action.patch },
        dirty: true,
        pendingPatches: { ...state.pendingPatches, appraisal: { ...state.pendingPatches.appraisal, ...action.patch } },
      }
    case 'patch_override': {
      const current = state.overrides[action.blockId] ?? {}
      const next = { ...current, ...action.patch }
      return {
        ...state,
        overrides: { ...state.overrides, [action.blockId]: next },
        dirty: true,
        pendingPatches: {
          ...state.pendingPatches,
          overrides: { ...state.pendingPatches.overrides, [action.blockId]: { ...(state.pendingPatches.overrides[action.blockId] ?? {}), ...action.patch } },
        },
      }
    }
    case 'consume_pending':
      return { ...state, dirty: false, pendingPatches: { appraisal: {}, overrides: {} } }
    default:
      return state
  }
}

export function useEditorState(initial: any) {
  return useReducer(editorReducer, {
    appraisal: initial,
    overrides: typeof initial.block_overrides_json === 'string'
      ? (JSON.parse(initial.block_overrides_json) as BlockOverrides)
      : (initial.block_overrides_json ?? {}),
    dirty: false,
    pendingPatches: { appraisal: {}, overrides: {} },
  })
}
```

---

### Task 31: `useAutosave.ts` hook

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/useAutosave.ts`

- [ ] **Step 1: Write the hook**

```typescript
'use client'
import { useEffect, useRef, useState } from 'react'
import { updateAppraisal, patchBlockOverride } from '../shared/api'

export type SaveStatus = 'idle' | 'debouncing' | 'saving' | 'saved' | 'error'

interface PendingPatches {
  appraisal: Record<string, unknown>
  overrides: Record<string, Record<string, unknown>>
}

interface Params {
  appraisalId: string
  pending: PendingPatches
  dirty: boolean
  onConsume: () => void
}

const DEBOUNCE_MS = 2000

export function useAutosave({ appraisalId, pending, dirty, onConsume }: Params) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!dirty) return
    setStatus('debouncing')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()
      try {
        const tasks: Promise<unknown>[] = []
        if (Object.keys(pending.appraisal).length > 0) {
          tasks.push(updateAppraisal(appraisalId, pending.appraisal))
        }
        for (const [blockId, patch] of Object.entries(pending.overrides)) {
          if (Object.keys(patch).length > 0) {
            tasks.push(patchBlockOverride(appraisalId, blockId, patch))
          }
        }
        await Promise.all(tasks)
        setStatus('saved')
        setLastSavedAt(Date.now())
        onConsume()
      } catch (e) {
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dirty, pending, appraisalId, onConsume])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  return { status, lastSavedAt }
}
```

---

### Task 32: `SyncBanner.tsx`

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/SyncBanner.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { getTemplate, syncTemplate } from '../shared/api'

interface Props {
  appraisalId: string
  templateId: string
  templateSyncedAt: string | null
  onSynced: () => void
}

export function SyncBanner({ appraisalId, templateId, templateSyncedAt, onSynced }: Props) {
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    getTemplate(templateId).then(t => {
      setTemplateUpdatedAt(t.updated_at ?? null)
      setTemplateName(t.name ?? '')
    }).catch(() => {})
  }, [templateId])

  const needsSync = templateUpdatedAt && templateSyncedAt && new Date(templateUpdatedAt).getTime() > new Date(templateSyncedAt).getTime()
  if (!needsSync) return null

  const handleSync = async () => {
    setSyncing(true)
    try { await syncTemplate(appraisalId); onSynced() }
    finally { setSyncing(false) }
  }

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertCircle className="h-4 w-4" />
      <span>El template <strong>{templateName}</strong> fue actualizado. Tu tasación todavía usa la versión anterior.</span>
      <button onClick={handleSync} disabled={syncing} className="ml-auto flex items-center gap-1 rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50">
        {syncing && <Loader2 className="h-3 w-3 animate-spin" />} Actualizar mi tasación
      </button>
    </div>
  )
}
```

---

### Task 33: Block forms (one per editable type)

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/BlockForm.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/editor/block-forms/*.tsx` (one per type that is editable; read-only display for non-editable)

Editable blocks typically reflect the block types and their data shapes from spec §5. Form fields map 1:1 to `data` keys.

- [ ] **Step 1: Write the dispatcher `BlockForm.tsx`**

```typescript
'use client'
import type { TemplateBlock, BindingMode, AppraisalBlockType } from '../renderer/types'
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
  context: 'appraisal' | 'template'  // appraisal hides non-editable binding_modes
}

const TASACION_EDITABLE: Set<BindingMode> = new Set(['tasacion', 'default-override'])

export function BlockForm({ block, override, onPatch, context }: Props) {
  if (context === 'appraisal' && !TASACION_EDITABLE.has(block.binding_mode)) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        🔒 Este bloque se configura desde Configuración → Tasación → Templates.
      </div>
    )
  }
  const merged = { ...block.data, ...override }
  const props = { data: merged, onPatch }
  switch (block.type) {
    case 'cover': return <CoverForm {...props} />
    case 'proposal_commercial': return <ProposalCommercialForm {...props} />
    case 'services_grid': return <ServicesGridForm {...props} />
    case 'market_stats': return <MarketStatsForm {...props} />
    case 'funnel_chart': return <FunnelChartForm {...props} />
    case 'methodology': return <MethodologyForm {...props} />
    case 'notary_charts': return <NotaryChartsForm {...props} />
    case 'zone_map': return <ZoneMapForm {...props} />
    case 'comparables_list': return <ComparablesListForm {...props} />
    case 'price_projection': return <div className="text-xs text-slate-500">Se completa con los precios del paso "FODA + Precios".</div>
    case 'work_conditions': return <WorkConditionsForm {...props} />
    case 'video_gallery': return <VideoGalleryForm {...props} />
    case 'extra_media': return <ExtraMediaForm {...props} />
    case 'cta_whatsapp': return <CtaWhatsappForm {...props} />
    case 'agent_contact_card': return <AgentContactCardForm {...props} />
    case 'swot':
    case 'property_data':
      return <div className="text-xs text-slate-500">Se completa con los datos de la propiedad / FODA en el panel de arriba.</div>
    default: return null
  }
}
```

- [ ] **Step 2: Write form files (one per type)**

Each form is ~30-60 lines: takes `{ data, onPatch }` and renders inputs that call `onPatch({ field: value })`. Example for `WorkConditionsForm`:

```typescript
'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function WorkConditionsForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Honorarios %</span>
        <input type="number" step="0.1" value={data.honorarios_pct ?? ''} onChange={e => onPatch({ honorarios_pct: e.target.value ? Number(e.target.value) : null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Exclusividad (días)</span>
        <input type="number" value={data.exclusividad_dias ?? ''} onChange={e => onPatch({ exclusividad_dias: e.target.value ? Number(e.target.value) : null })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Texto legal</span>
        <textarea rows={3} value={data.legal_text ?? ''} onChange={e => onPatch({ legal_text: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
      </label>
    </div>
  )
}
```

Follow the same pattern for the other 13 forms. For list-typed fields (items, services, videos, media, required_docs, funnel, vars), render a `<ul>` + "Agregar" button + per-item remove. Keep forms pragmatic — no fancy validation beyond type coercion.

The forms for `services_grid`, `proposal_commercial`, `funnel_chart`, `video_gallery`, `extra_media` handle list-of-objects: edit in place, "Agregar" appends, "Eliminar" filters. `market_stats` and `notary_charts` edit lists of variable keys (input + autocomplete from `listVariables()` optional). `zone_map` is straightforward number/text fields. `cta_whatsapp` is 3 text fields. `agent_contact_card` is 5 fields. `cover` is title/subtitle/cover_image_url.

- [ ] **Step 3: Typecheck**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "editor/block-forms" | head
```

Expected: no errors.

---

### Task 34: `BlockList.tsx` + `EditorShell.tsx`

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/editor/BlockList.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/editor/EditorShell.tsx`

- [ ] **Step 1: Write `BlockList.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, Lock } from 'lucide-react'
import type { TemplateBlock } from '../renderer/types'
import { BlockForm } from './BlockForm'

interface Props {
  blocks: TemplateBlock[]
  overrides: Record<string, Record<string, unknown>>
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  context: 'appraisal' | 'template'
}

export function BlockList({ blocks, overrides, onPatchOverride, context }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }
  return (
    <div className="space-y-1">
      {blocks.map(b => {
        const isLocked = context === 'appraisal' && b.binding_mode !== 'tasacion' && b.binding_mode !== 'default-override'
        const open = expanded.has(b.id)
        return (
          <div key={b.id} className="rounded border border-slate-200">
            <button onClick={() => toggle(b.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {isLocked && <Lock className="h-3 w-3 text-slate-400" />}
                {b.type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400">{b.binding_mode}</span>
            </button>
            {open && (
              <BlockForm
                block={b}
                override={overrides[b.id] ?? {}}
                onPatch={(patch) => onPatchOverride(b.id, patch)}
                context={context}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Write `EditorShell.tsx`**

Key behaviors:
- Load template snapshot from `appraisal.template_snapshot_json` (or empty array if no template).
- Appraisal-fields form (address, neighborhood, city, property_type, 4 superficies, SWOT textareas, 4 price inputs) dispatching `patch_appraisal`.
- `<BlockList/>` for template blocks dispatching `patch_override`.
- `<TemplateRenderer/>` in right panel consuming current state.
- `<SyncBanner/>` at top if `appraisal.template_id`.
- Header: Back button + "Ver pública ↗" (link to `/t/${public_slug}` with target _blank, disabled if no slug) + autosave status + Publish button (if no slug yet).
- Toggle Web/Print above preview.
- Mobile: floating bottom button "👁 Preview" opens bottom sheet with renderer.

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useEditorState } from './useEditorState'
import { useAutosave } from './useAutosave'
import { BlockList } from './BlockList'
import { SyncBanner } from './SyncBanner'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import type { TemplateBlock, AppraisalContext, RenderMode } from '../renderer/types'

interface Props {
  initial: any                           // appraisal from GET /appraisals?id
  snapshot: TemplateBlock[]              // template_snapshot_json parsed
  context: 'appraisal' | 'template'      // 'template' enables admin UI (reorder, binding_mode, +bloque)
}

function buildCtx(a: any): AppraisalContext {
  return {
    id: a.id,
    property_address: a.property_address,
    neighborhood: a.neighborhood ?? null,
    city: a.city ?? null,
    property_type: a.property_type ?? null,
    covered_area: a.covered_area ?? null,
    total_area: a.total_area ?? null,
    semi_area: a.semi_area ?? null,
    weighted_area: a.weighted_area ?? null,
    swot: { strengths: a.strengths ?? null, weaknesses: a.weaknesses ?? null, opportunities: a.opportunities ?? null, threats: a.threats ?? null },
    prices: { suggested: a.suggested_price ?? null, test: a.test_price ?? null, expected_close: a.expected_close_price ?? null, usd_per_m2: a.usd_per_m2 ?? null },
    comparables: a.comparables ?? [],
    agent: a.agent ?? null,
    org: a.org ?? null,
  }
}

export function EditorShell({ initial, snapshot, context }: Props) {
  const [state, dispatch] = useEditorState(initial)
  const [mode, setMode] = useState<RenderMode>('web')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)

  const onConsume = useCallback(() => dispatch({ type: 'consume_pending' }), [dispatch])
  const { status, lastSavedAt } = useAutosave({
    appraisalId: state.appraisal.id,
    pending: state.pendingPatches,
    dirty: state.dirty,
    onConsume,
  })

  const ctx = buildCtx(state.appraisal)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/tasaciones" className="text-slate-500"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-sm font-semibold">{state.appraisal.property_address}</h1>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus status={status} lastSavedAt={lastSavedAt} />
          {state.appraisal.public_slug && (
            <a href={`/t/${state.appraisal.public_slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-slate-600 hover:text-[#ff007c]">
              Ver pública <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </header>

      {state.appraisal.template_id && (
        <SyncBanner
          appraisalId={state.appraisal.id}
          templateId={state.appraisal.template_id}
          templateSyncedAt={state.appraisal.template_synced_at ?? null}
          onSynced={() => location.reload()}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="border-r border-slate-200 bg-white p-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Datos de la propiedad</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <AppraisalField label="Dirección" value={state.appraisal.property_address} onChange={v => dispatch({ type: 'patch_appraisal', patch: { property_address: v } })} />
              <AppraisalField label="Barrio" value={state.appraisal.neighborhood} onChange={v => dispatch({ type: 'patch_appraisal', patch: { neighborhood: v } })} />
              <AppraisalField label="Cubierta m²" type="number" value={state.appraisal.covered_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { covered_area: Number(v) } })} />
              <AppraisalField label="Total m²" type="number" value={state.appraisal.total_area} onChange={v => dispatch({ type: 'patch_appraisal', patch: { total_area: Number(v) } })} />
            </div>
          </section>
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">FODA</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(k => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500">{k}</span>
                  <textarea rows={3} value={state.appraisal[k] ?? ''} onChange={e => dispatch({ type: 'patch_appraisal', patch: { [k]: e.target.value } })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
                </label>
              ))}
            </div>
          </section>
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bloques del template</h2>
            <div className="mt-3">
              <BlockList blocks={snapshot} overrides={state.overrides} onPatchOverride={(id, patch) => dispatch({ type: 'patch_override', blockId: id, patch })} context={context} />
            </div>
          </section>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
              <button onClick={() => setMode('web')} className={`rounded px-3 py-1 text-xs ${mode === 'web' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Web</button>
              <button onClick={() => setMode('print')} className={`rounded px-3 py-1 text-xs ${mode === 'print' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Print</button>
            </div>
            <TemplateRenderer snapshot={snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} />
          </div>
        </div>
      </div>

      <button onClick={() => setMobilePreviewOpen(true)} className="fixed bottom-6 right-6 z-30 rounded-full bg-[#ff007c] px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden">
        👁 Preview
      </button>
      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <button onClick={() => setMobilePreviewOpen(false)} className="absolute right-4 top-4 z-10 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Cerrar</button>
          <div className="h-full overflow-y-auto">
            <TemplateRenderer snapshot={snapshot} overrides={state.overrides} appraisal={ctx} mode={mode} />
          </div>
        </div>
      )}
    </div>
  )
}

function AppraisalField({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-sm" />
    </label>
  )
}

function SaveStatus({ status, lastSavedAt }: { status: string; lastSavedAt: number | null }) {
  if (status === 'saving') return <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>
  if (status === 'saved') return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Guardado</span>
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-rose-600"><AlertCircle className="h-3 w-3" /> Error al guardar</span>
  if (status === 'debouncing') return <span className="text-xs text-slate-400">Cambios pendientes...</span>
  return null
}
```

---

### Task 35: Replace `/tasaciones/[id]/editar/page.tsx`

**Files:**
- Modify (full rewrite): `vendepro-frontend/src/app/(dashboard)/tasaciones/[id]/editar/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { notFound } from 'next/navigation'
import { EditorShell } from '@/components/tasaciones/editor/EditorShell'
import { getTemplate, getAppraisal } from '@/components/tasaciones/shared/api'
import type { TemplateBlock } from '@/components/tasaciones/renderer/types'
import '@/components/tasaciones/renderer/print.css'

export default async function EditarTasacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appraisal = await getAppraisal(id).catch(() => null)
  if (!appraisal) notFound()

  let snapshot: TemplateBlock[] = []
  if (appraisal.template_snapshot_json) {
    try {
      snapshot = typeof appraisal.template_snapshot_json === 'string'
        ? JSON.parse(appraisal.template_snapshot_json)
        : appraisal.template_snapshot_json
    } catch {}
  } else if (appraisal.template_id) {
    const t = await getTemplate(appraisal.template_id).catch(() => null)
    snapshot = t?.blocks ?? []
  }

  return <EditorShell initial={appraisal} snapshot={snapshot} context="appraisal" />
}
```

- [ ] **Step 2: Typecheck**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | grep -E "editor" | head
```

Expected: no errors.

---

## Phase F — Admin templates

### Task 36: Install @dnd-kit

**Files:**
- Modify: `vendepro-frontend/package.json` (dependency add)

- [ ] **Step 1: Install**

```bash
cd vendepro-frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added, no errors.

---

### Task 37: `TemplatesHome.tsx`

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/TemplatesHome.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Archive, Edit, MoreVertical } from 'lucide-react'
import { listTemplates, createTemplate, duplicateTemplate, archiveTemplate } from '../shared/api'

const KINDS = ['casa', 'depto', 'terreno', 'corporativo', 'custom'] as const

export function TemplatesHome() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<typeof KINDS[number]>('casa')

  const load = () => listTemplates().then(setTemplates)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const { id } = await createTemplate({ name: newName, kind: newKind, blocks: [] })
    router.push(`/configuracion/tasacion/templates/${id}`)
  }
  const handleDuplicate = async (id: string, name: string) => {
    const { id: newId } = await duplicateTemplate(id, { new_name: `${name} (copia)` })
    router.push(`/configuracion/tasacion/templates/${newId}`)
  }
  const handleArchive = async (id: string) => {
    if (!confirm('¿Archivar este template?')) return
    await archiveTemplate(id)
    load()
  }

  if (templates === null) return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-100" />)}</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">{templates.length} templates</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded bg-[#ff007c] px-3 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> Crear template
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <article key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {t.preview_image_url && <img src={t.preview_image_url} alt="" className="mb-3 aspect-video w-full rounded object-cover" />}
            <h3 className="font-semibold">{t.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{t.kind} · {(t.blocks ?? []).length} bloques {t.is_system ? '· sistema' : ''}</p>
            <div className="mt-4 flex gap-2">
              {!t.is_system && <button onClick={() => router.push(`/configuracion/tasacion/templates/${t.id}`)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Edit className="h-3 w-3" /> Editar</button>}
              <button onClick={() => handleDuplicate(t.id, t.name)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Copy className="h-3 w-3" /> Duplicar</button>
              {!t.is_system && <button onClick={() => handleArchive(t.id)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Archive className="h-3 w-3" /> Archivar</button>}
            </div>
          </article>
        ))}
      </div>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Nuevo template</h3>
            <div className="mt-4 space-y-3">
              <input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              <select value={newKind} onChange={e => setNewKind(e.target.value as any)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Task 38: `MOCK_APPRAISAL.ts`

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/MOCK_APPRAISAL.ts`

- [ ] **Step 1: Write the mock**

```typescript
import type { AppraisalContext } from '../renderer/types'

export const MOCK_APPRAISAL: AppraisalContext = {
  id: 'mock',
  property_address: 'Av. Siempreviva 742',
  neighborhood: 'Villa Urquiza',
  city: 'CABA',
  property_type: 'casa',
  covered_area: 185,
  total_area: 240,
  semi_area: 20,
  weighted_area: 200,
  swot: {
    strengths: 'Ubicación cercana al subte. Casa bien iluminada.',
    weaknesses: 'Necesita pintura en ambientes principales.',
    opportunities: 'Zona con plusvalía ascendente.',
    threats: 'Nuevos desarrollos cercanos.',
  },
  prices: { suggested: 450000, test: 475000, expected_close: 420000, usd_per_m2: 2432 },
  comparables: [
    { id: 'c1', appraisal_id: 'mock', zonaprop_url: null, address: 'Av. Cabildo 3000', total_area: 200, covered_area: 180, price: 440000, usd_per_m2: 2444, sort_order: 0 },
    { id: 'c2', appraisal_id: 'mock', zonaprop_url: null, address: 'Mendoza 4200', total_area: 220, covered_area: 195, price: 460000, usd_per_m2: 2359, sort_order: 1 },
  ],
  agent: { name: 'Marcela Genta', phone: '+5411 5555-5555', email: 'marcela@mg.com', avatar_url: null },
  org: { name: 'Marcela Genta Operaciones Inmobiliarias', logo_url: null, brand_color: '#ff007c', brand_accent_color: '#ff8017' },
}
```

---

### Task 39: `BlockAdminForm.tsx` (extiende BlockForm con binding_mode + include_in_pdf)

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/BlockAdminForm.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'
import type { TemplateBlock, BindingMode, AppraisalBlockType } from '../renderer/types'
import { BlockForm } from '../editor/BlockForm'

const BINDING_MODES: BindingMode[] = ['system', 'org-static', 'org-variable', 'tasacion', 'default-override']

const PDF_LOCKED: Set<AppraisalBlockType> = new Set([
  'cover', 'property_data', 'swot', 'price_projection',
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
])

interface Props {
  block: TemplateBlock
  onPatchBlock: (patch: Partial<TemplateBlock>) => void
  onPatchData: (patch: Record<string, unknown>) => void
  onRemove: () => void
}

export function BlockAdminForm({ block, onPatchBlock, onPatchData, onRemove }: Props) {
  const pdfLocked = PDF_LOCKED.has(block.type)
  return (
    <div className="space-y-3 border-t border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-600">Binding mode</span>
          <select value={block.binding_mode} onChange={e => onPatchBlock({ binding_mode: e.target.value as BindingMode })} className="rounded border border-slate-300 px-2 py-1 text-sm">
            {BINDING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={pdfLocked} checked={block.include_in_pdf} onChange={e => onPatchBlock({ include_in_pdf: e.target.checked })} />
          <span className={pdfLocked ? 'text-slate-400' : ''}>Incluir en PDF</span>
        </label>
        <button onClick={onRemove} className="ml-auto text-xs text-rose-500">Eliminar</button>
      </div>
      <BlockForm block={block} override={{}} onPatch={onPatchData} context="template" />
    </div>
  )
}
```

---

### Task 40: `TemplateEditor.tsx` with drag-drop + autosave

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/TemplateEditor.tsx`

- [ ] **Step 1: Write the component**

Uses `@dnd-kit/sortable` for reorder. Separate autosave (debounced PUT to `/appraisal-templates/:id` with full `blocks` array).

```typescript
'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Loader2, CheckCircle2 } from 'lucide-react'
import { getTemplate, updateTemplate } from '../shared/api'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import { BlockAdminForm } from './BlockAdminForm'
import { MOCK_APPRAISAL } from './MOCK_APPRAISAL'
import type { TemplateBlock, AppraisalBlockType } from '../renderer/types'
import { APPRAISAL_BLOCK_TYPES } from '../renderer/types'

const DEBOUNCE_MS = 2000

function SortableBlock({ block, children }: { block: TemplateBlock; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button {...attributes} {...listeners} className="cursor-grab text-slate-400"><GripVertical className="h-4 w-4" /></button>
        <span className="text-sm font-medium">{block.type.replace(/_/g, ' ')}</span>
      </div>
      {children}
    </div>
  )
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter()
  const [template, setTemplate] = useState<any>(null)
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [adding, setAdding] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    getTemplate(templateId).then(t => { setTemplate(t); setBlocks(t.blocks ?? []) })
  }, [templateId])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      await updateTemplate(templateId, { blocks })
      setStatus('saved')
      setDirty(false)
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dirty, blocks, templateId])

  const handleDragEnd = (e: any) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = blocks.findIndex(b => b.id === active.id)
    const newIdx = blocks.findIndex(b => b.id === over.id)
    const reordered = arrayMove(blocks, oldIdx, newIdx).map((b, i) => ({ ...b, sort_order: i }))
    setBlocks(reordered); setDirty(true)
  }

  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...patch } : b)); setDirty(true)
  }
  const updateBlockData = (id: string, patch: Record<string, unknown>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)); setDirty(true)
  }
  const removeBlock = (id: string) => { setBlocks(blocks.filter(b => b.id !== id)); setDirty(true) }
  const addBlock = (type: AppraisalBlockType) => {
    const id = `b-${Date.now()}`
    setBlocks([...blocks, { id, type, binding_mode: 'tasacion', include_in_pdf: true, sort_order: blocks.length, data: {} }])
    setDirty(true); setAdding(false)
  }

  if (!template) return <div className="p-12 text-center text-slate-400">Cargando template...</div>

  const isSystem = !!template.is_system

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-sm font-semibold">{template.name}</h1>
        <div className="flex items-center gap-3 text-xs">
          {status === 'saving' && <span className="flex items-center gap-1 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>}
          {status === 'saved' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Guardado</span>}
        </div>
      </header>

      {isSystem && (
        <div className="bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Template del sistema (read-only). <button onClick={() => router.push('/configuracion/tasacion')} className="underline">Volver</button>
        </div>
      )}

      <div className="bg-rose-50 px-4 py-2 text-xs text-rose-800">
        Cambios afectan tasaciones nuevas. Las existentes ven banner con opción de actualizar.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="border-r border-slate-200 bg-white p-6">
          <div className="mb-4 flex justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bloques</h2>
            {!isSystem && <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Agregar</button>}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map(b => (
                  <SortableBlock key={b.id} block={b}>
                    {!isSystem && (
                      <BlockAdminForm
                        block={b}
                        onPatchBlock={p => updateBlock(b.id, p)}
                        onPatchData={p => updateBlockData(b.id, p)}
                        onRemove={() => removeBlock(b.id)}
                      />
                    )}
                  </SortableBlock>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <TemplateRenderer snapshot={blocks} appraisal={MOCK_APPRAISAL} mode="web" />
          </div>
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Agregar bloque</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {APPRAISAL_BLOCK_TYPES.map(t => (
                <button key={t} onClick={() => addBlock(t)} className="rounded border border-slate-300 px-2 py-2 text-xs hover:border-[#ff007c]">
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setAdding(false)} className="mt-4 rounded px-4 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Task 41: Template editor route `/configuracion/tasacion/templates/[id]/page.tsx`

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/configuracion/tasacion/templates/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { TemplateEditor } from '@/components/tasaciones/admin/TemplateEditor'
import '@/components/tasaciones/renderer/print.css'

export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TemplateEditor templateId={id} />
}
```

---

## Phase G — Admin variables + general + hub

### Task 42: `VariablesHome.tsx` + `VariableModal.tsx`

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/VariablesHome.tsx`
- Create: `vendepro-frontend/src/components/tasaciones/admin/VariableModal.tsx`

- [ ] **Step 1: Write `VariableModal.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createVariable } from '../shared/api'

interface Props { onClose: () => void; onCreated: () => void }

const VALUE_TYPES = ['number', 'percent', 'text', 'date', 'image_url'] as const

export function VariableModal({ onClose, onCreated }: Props) {
  const [keySuffix, setKeySuffix] = useState('')
  const [label, setLabel] = useState('')
  const [valueType, setValueType] = useState<typeof VALUE_TYPES[number]>('text')
  const [value, setValue] = useState('')

  const keyValid = /^[a-z_][a-z0-9_]*$/.test(keySuffix)

  const save = async () => {
    if (!keyValid) return
    await createVariable({ key: `custom.${keySuffix}`, label, value_type: valueType, value, namespace: 'custom' })
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Nueva variable custom</h3>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Key</span>
            <div className="flex items-center gap-0 rounded border border-slate-300 text-sm">
              <span className="bg-slate-100 px-2 py-2 text-slate-500">custom.</span>
              <input value={keySuffix} onChange={e => setKeySuffix(e.target.value)} className="flex-1 px-2 py-2" placeholder="mi_variable" />
            </div>
            {!keyValid && keySuffix && <span className="text-xs text-rose-500">Solo letras, números y _, debe empezar con letra</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Label</span>
            <input value={label} onChange={e => setLabel(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Tipo</span>
            <select value={valueType} onChange={e => setValueType(e.target.value as any)} className="rounded border border-slate-300 px-3 py-2 text-sm">
              {VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Valor inicial</span>
            <input value={value} onChange={e => setValue(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-sm">Cancelar</button>
          <button onClick={save} disabled={!keyValid} className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white disabled:opacity-40">Crear</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `VariablesHome.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { listVariables, updateVariable, deleteVariable } from '../shared/api'
import { VariableModal } from './VariableModal'

const NAMESPACES = ['market', 'notary', 'custom'] as const

export function VariablesHome() {
  const [vars, setVars] = useState<any[] | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const load = () => listVariables().then(setVars)
  useEffect(() => { load() }, [])

  const saveRow = async (id: string, value: string) => {
    await updateVariable(id, { value })
    setEditing({ ...editing, [id]: '' })
    load()
  }
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar variable?')) return
    await deleteVariable(id); load()
  }

  if (vars === null) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />)}</div>

  return (
    <div className="space-y-6">
      {NAMESPACES.map(ns => {
        const list = vars.filter(v => v.namespace === ns)
        return (
          <section key={ns} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{ns}</h2>
              {ns === 'custom' && <button onClick={() => setModalOpen(true)} className="flex items-center gap-1 rounded bg-[#ff007c] px-3 py-1 text-xs text-white"><Plus className="h-3 w-3" /> Nueva</button>}
            </div>
            {list.length === 0 && ns === 'custom' && <p className="mt-3 text-sm text-slate-400">Todavía no creaste variables custom.</p>}
            {list.length > 0 && (
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Key</th><th>Label</th><th>Tipo</th><th>Valor</th><th></th></tr></thead>
                <tbody>
                  {list.map(v => {
                    const current = editing[v.id] ?? v.value
                    return (
                      <tr key={v.id} className="border-t border-slate-100">
                        <td className="py-2 font-mono text-xs">{v.key}</td>
                        <td>{v.label ?? '—'}</td>
                        <td className="text-xs text-slate-500">{v.value_type}</td>
                        <td><input value={current} onChange={e => setEditing({ ...editing, [v.id]: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                        <td className="flex gap-1">
                          {editing[v.id] !== undefined && editing[v.id] !== v.value && <button onClick={() => saveRow(v.id, current)} className="rounded bg-[#ff007c] px-2 py-1 text-xs text-white">Guardar</button>}
                          {ns === 'custom' && !v.is_system && <button onClick={() => handleDelete(v.id)} className="text-rose-500"><Trash2 className="h-3 w-3" /></button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
      {modalOpen && <VariableModal onClose={() => setModalOpen(false)} onCreated={load} />}
    </div>
  )
}
```

---

### Task 43: `OrgConfigForm.tsx` (General tab with on-demand variable creation)

**Files:**
- Create: `vendepro-frontend/src/components/tasaciones/admin/OrgConfigForm.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { listVariables, createVariable, updateVariable } from '../shared/api'
import { ImageUpload } from '@/components/landings/ImageUpload'

const SIGNATURE_KEY = 'custom.org_signature_url'
const DISCLAIMER_KEY = 'custom.org_disclaimer_legal'

export function OrgConfigForm() {
  const [signatureVar, setSignatureVar] = useState<any>(null)
  const [disclaimerVar, setDisclaimerVar] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    const all = await listVariables()
    let sig = all.find((v: any) => v.key === SIGNATURE_KEY)
    let dis = all.find((v: any) => v.key === DISCLAIMER_KEY)
    if (!sig) {
      const { id } = await createVariable({ key: SIGNATURE_KEY, label: 'Firma del titular', value: '', value_type: 'image_url', namespace: 'custom' })
      sig = { id, key: SIGNATURE_KEY, label: 'Firma', value: '', value_type: 'image_url', namespace: 'custom' }
    }
    if (!dis) {
      const { id } = await createVariable({ key: DISCLAIMER_KEY, label: 'Disclaimer legal', value: '', value_type: 'text', namespace: 'custom' })
      dis = { id, key: DISCLAIMER_KEY, label: 'Disclaimer', value: '', value_type: 'text', namespace: 'custom' }
    }
    setSignatureVar(sig); setDisclaimerVar(dis); setLoading(false)
  })() }, [])

  if (loading) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />

  const updateSig = async (url: string) => {
    await updateVariable(signatureVar.id, { value: url })
    setSignatureVar({ ...signatureVar, value: url })
  }
  const updateDis = async (text: string) => {
    await updateVariable(disclaimerVar.id, { value: text })
    setDisclaimerVar({ ...disclaimerVar, value: text })
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Firma del titular</h3>
        <p className="mt-1 text-xs text-slate-500">Se usa en los bloques que la referencien.</p>
        <div className="mt-3">
          <ImageUpload value={signatureVar.value} onChange={updateSig} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Disclaimer legal</h3>
        <textarea value={disclaimerVar.value} onChange={e => updateDis(e.target.value)} rows={6} className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
      </div>
    </div>
  )
}
```

**NOTE:** `<ImageUpload/>` is assumed to exist in `components/landings/`. If its props differ, adapt.

---

### Task 44: Hub page `/configuracion/tasacion/page.tsx` with tabs

**Files:**
- Modify (full rewrite): `vendepro-frontend/src/app/(dashboard)/configuracion/tasacion/page.tsx`

- [ ] **Step 1: Write the hub**

```typescript
'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { TemplatesHome } from '@/components/tasaciones/admin/TemplatesHome'
import { VariablesHome } from '@/components/tasaciones/admin/VariablesHome'
import { OrgConfigForm } from '@/components/tasaciones/admin/OrgConfigForm'

const TABS = [
  { key: 'templates', label: 'Templates' },
  { key: 'variables', label: 'Variables' },
  { key: 'general', label: 'General' },
] as const

export default function ConfigTasacionPage() {
  const qp = useSearchParams()
  const router = useRouter()
  const active = (qp.get('tab') ?? 'templates') as typeof TABS[number]['key']

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">Configuración · Tasaciones</h1>
      <nav className="mt-6 border-b border-slate-200">
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => router.push(`/configuracion/tasacion?tab=${t.key}`)}
            className={`border-b-2 px-4 py-2 text-sm ${active === t.key ? 'border-[#ff007c] text-[#ff007c]' : 'border-transparent text-slate-500'}`}
          >{t.label}</button>
        ))}
      </nav>
      <div className="mt-6">
        {active === 'templates' && <TemplatesHome />}
        {active === 'variables' && <VariablesHome />}
        {active === 'general' && <OrgConfigForm />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Admin-only permission check**

Verify middleware or add a check at the page level. Read `vendepro-frontend/src/middleware.ts` or the layout at `/(dashboard)/configuracion/layout.tsx`. If needed, create/modify to redirect non-admin users.

Run:
```bash
grep -rn "admin" vendepro-frontend/src/middleware.ts vendepro-frontend/src/app/\(dashboard\)/configuracion/layout.tsx 2>&1 | head
```

If not protected, add check in `layout.tsx` using `getCurrentUser()`.

---

## Phase H — Final verification + single commit

### Task 45: Full typecheck + test run

- [ ] **Step 1: Typecheck the whole frontend**

```bash
cd vendepro-frontend && npx tsc --noEmit 2>&1 | tail -30
```

Expected: no errors. If there are errors, fix them (usually missing imports or mismatched types).

- [ ] **Step 2: Run vitest**

```bash
cd vendepro-frontend && npx vitest run 2>&1 | tail -30
```

Expected: all tests PASS — includes `hydrate-blocks.test.ts` (7 tests) + `blocks-smoke.test.tsx` (17 tests).

- [ ] **Step 3: Next.js build**

```bash
cd vendepro-frontend && npx next build 2>&1 | tail -20
```

Expected: build succeeds. If there are errors about server/client components or dynamic imports, fix them.

---

### Task 46: Manual E2E checklist

Start local servers (frontend + backend APIs) and execute:

- [ ] Agente crea tasación con template "Casa Sistema" → redirect al editor → autosave de address funciona en 2s.
- [ ] Agente edita bloque `work_conditions` → override guardado → se ve en preview.
- [ ] Click "Ver pública ↗" abre `/t/[slug]` en nueva pestaña con renderer nuevo.
- [ ] Admin duplica "Casa" → editor del custom permite reordenar bloques con drag-drop → cambios persisten (refresh página).
- [ ] Admin cambia `binding_mode` de un bloque → se ve reflejado en preview con MOCK_APPRAISAL.
- [ ] Admin crea variable custom `custom.award_count=12` → aparece en lista.
- [ ] Admin entra a tab "General" → se crean las 2 variables on-demand (firma + disclaimer).
- [ ] Tasación legacy (sin `template_id`) renderiza en `/t/[slug]` con `PublicAppraisalShell` legacy.
- [ ] Template actualizado desde admin → tasación existente muestra sync banner → click actualiza.
- [ ] Landing pública en mobile: tipografía grande, stack vertical, CTAs visibles.
- [ ] `/t/[slug]?print=1` oculta bloques web-only visualmente.

If any step fails, fix before proceeding to commit.

---

### Task 47: Single big commit + push

- [ ] **Step 1: Stage all frontend changes + spec + any backend change from Task 23**

```bash
git add vendepro-frontend/src/components/tasaciones \
        vendepro-frontend/src/app/\(dashboard\)/tasaciones \
        vendepro-frontend/src/app/\(dashboard\)/configuracion/tasacion \
        vendepro-frontend/src/app/t/\[slug\] \
        vendepro-frontend/package.json \
        vendepro-frontend/package-lock.json \
        docs/superpowers/plans/2026-04-24-tasaciones-templates-frontend.md
# Only if Task 23 modified api-public:
# git add vendepro-backend/packages/api-public vendepro-backend/packages/core
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(tasaciones): frontend del sistema de templates (Sub-plan 2)

Sub-plan 2 de 3 — Frontend completo del feature. Introduce:
- Renderer: <TemplateRenderer/> + <BlockRenderer/> + 17 bloques tipados
  (cover, proposal, services, market stats, funnel, methodology,
  notary, property data, swot, zone map, comparables, price,
  work conditions, video, extra media, CTA, agent card, fallback)
- Hidratación client-side (port del HydrateTemplateBlocksUseCase)
- Print CSS dual-path (@media + [data-force-print]) listo para Sub-plan 3
- Wizard 4 pasos (/tasaciones/nueva) con selección de template
- Editor split 50/50 (/tasaciones/[id]/editar) con preview in-place +
  autosave debounced + sync banner cuando cambia el template
- Admin completo (/configuracion/tasacion/) — templates list + editor
  con drag-drop (@dnd-kit), variables por namespace + modal custom,
  general tab con firma + disclaimer creadas on-demand
- Runtime switch en /t/[slug]: renderer nuevo si template_id, legacy
  (PublicAppraisalShell) en paralelo si no
- Desktop-first para creación (wizard/editor/admin), mobile-first para
  landing pública
- Cleanup: elimina wizard steps legacy (Proposal/MarketSituation/
  WorkConditions/PreviewPane/wizardTypes)

Spec: docs/superpowers/specs/2026-04-24-tasaciones-templates-frontend-design.md
Plan: docs/superpowers/plans/2026-04-24-tasaciones-templates-frontend.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push to main** (triggers GH Actions deploy)

```bash
git push origin main
```

Expected: push succeeds. Monitor GH Actions: the frontend deploy workflow should trigger. Backend APIs don't need to redeploy unless Task 23 touched them.

- [ ] **Step 4: Verify deploy**

Wait for GH Actions to complete. Visit the production frontend URL and:
- Confirm `/configuracion/tasacion` loads with the 3 tabs.
- Confirm `/tasaciones/nueva` shows the new wizard.
- Confirm `/t/[seed-tasacion-slug]` renders (seed a tasación with `template_id` pointing to `sys-appraisal-casa-v1` via curl or the new wizard).

---

**End of Sub-plan 2.** After this lands, Sub-plan 3 brings:
- PDF generation via Cloudflare Browser Rendering (`POST /appraisals/:id/pdf` + quota + cache).
- `MigrateLegacyAppraisalUseCase` to migrate tasaciones with JSON legacy to the template model.
- Cron cleanup of `appraisal_pdfs` expired entries.
- Final deletion of `components/tasaciones/legacy/` and legacy fields in `appraisals`.



