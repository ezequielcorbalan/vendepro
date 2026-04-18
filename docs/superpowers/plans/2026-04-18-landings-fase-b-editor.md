# Landings con IA — Plan Fase B (Editor frontend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el editor de landings en `vendepro-frontend/`: 8 block components + `BlockRenderer`, listado de landings, wizard de creación, editor 3-panes con inspector + chat IA, drawers de versiones y configuración, flujo de approval admin, uploads a R2 + picker de fotos de propiedades.

**Architecture:** Next.js 15 App Router, client components para la UI interactiva, `apiFetch` a `api-crm` y `api-ai`. Tailwind 4 para estilos (light theme — **sin dark mode**), lucide-react para íconos, `@dnd-kit/core` para reorder drag-and-drop, Poppins + colores de marca `#ff007c` / `#ff8017`. Los block components se usan también en Fase C para la vista pública.

**Tech Stack:** Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS 4, `@dnd-kit/core` + `@dnd-kit/sortable`, `lucide-react`, `apiFetch` client.

**Spec de referencia:** `docs/superpowers/specs/2026-04-18-landings-design.md`

**Dependencia:** Fase A (backend) debe estar al menos parcialmente deployada — los endpoints de `api-crm` / `api-ai` responden. No hace falta que las landings se publiquen (Fase C infra no bloquea B).

**Árbol de archivos afectados** (solo nuevos/modificados):

```
vendepro-frontend/
  src/
    lib/
      landings/
        types.ts                                    (NEW — Block, Landing types, shape común con backend)
        api.ts                                      (NEW — wrappers de apiFetch para landings)
        slug.ts                                     (NEW — helpers slug base/suffix)
    components/
      landings/
        blocks/
          HeroBlock.tsx                             (NEW)
          HeroSplitBlock.tsx                        (NEW)
          FeaturesGridBlock.tsx                     (NEW)
          AmenitiesChipsBlock.tsx                   (NEW)
          GalleryBlock.tsx                          (NEW)
          BenefitsListBlock.tsx                     (NEW)
          LeadFormBlock.tsx                         (NEW)
          FooterBlock.tsx                           (NEW)
          index.ts                                  (NEW — BLOCK_COMPONENTS registry)
        BlockRenderer.tsx                           (NEW — public + editor modes)
        BlockListSidebar.tsx                        (NEW — left pane)
        EditorPreview.tsx                           (NEW — center pane)
        InspectorPanel.tsx                          (NEW — right, tab 1)
        AIChatPanel.tsx                             (NEW — right, tab 2)
        EditorToolbar.tsx                           (NEW — top)
        VersionsDrawer.tsx                          (NEW)
        ConfigDrawer.tsx                            (NEW)
        ImageUpload.tsx                             (NEW — R2 + external URL + property picker)
        PropertyPhotoPicker.tsx                     (NEW)
        TemplatePickerModal.tsx                     (NEW — step 1 del wizard)
        NewLandingModal.tsx                         (NEW — contiene el wizard 2 steps)
        LandingCard.tsx                             (NEW — list card)
        StatusBadge.tsx                             (NEW)
        PublishReviewBanner.tsx                     (NEW — banner con last_review_note)
    app/
      (dashboard)/
        landings/
          page.tsx                                  (NEW — listado)
          loading.tsx                               (NEW)
          [id]/
            page.tsx                                (NEW — editor shell)
            preview/
              page.tsx                              (NEW — preview interna de draft)
    lib/
      nav-config.ts                                 (MOD — agregar item "Landings")
```

---

## Task 1: Types + API client

**Files:**
- Create: `vendepro-frontend/src/lib/landings/types.ts`
- Create: `vendepro-frontend/src/lib/landings/api.ts`
- Create: `vendepro-frontend/src/lib/landings/slug.ts`

- [ ] **Step 1: Define Block types (espejan los de backend)**

Create `vendepro-frontend/src/lib/landings/types.ts`:

```typescript
// Espejan los shapes definidos en vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts
// Si el backend cambia, actualizar acá manualmente (o migrar a paquete compartido en fase futura).

export type BlockType =
  | 'hero'
  | 'hero-split'
  | 'features-grid'
  | 'amenities-chips'
  | 'gallery'
  | 'benefits-list'
  | 'lead-form'
  | 'footer'

export interface CtaData { label: string; href: string }

export interface HeroData {
  eyebrow?: string
  title: string
  subtitle?: string
  cta?: CtaData
  background_image_url: string
  overlay_opacity: number
}

export interface HeroSplitData {
  eyebrow?: string
  title: string
  subtitle?: string
  cta?: CtaData
  media_url: string
  media_side: 'left' | 'right'
  accent_color: 'pink' | 'orange' | 'dark'
}

export interface FeaturesGridData {
  title?: string
  subtitle?: string
  columns: 3 | 4
  items: Array<{ icon: string; title: string; text: string }>
}

export interface AmenitiesChipsData {
  title?: string
  chips: Array<{ emoji?: string; label: string }>
}

export interface GalleryImage {
  url: string
  alt?: string
  source: 'upload' | 'external' | 'property'
  property_id?: string
}

export interface GalleryData {
  layout: 'mosaic' | 'grid' | 'carousel'
  images: GalleryImage[]
}

export interface BenefitsListData {
  title?: string
  items: Array<{ title: string; description?: string }>
}

export type LeadFormFieldKey = 'name' | 'phone' | 'email' | 'address' | 'message'
export interface LeadFormField {
  key: LeadFormFieldKey
  label: string
  required: boolean
}

export interface LeadFormData {
  title: string
  subtitle?: string
  fields: LeadFormField[]
  submit_label: string
  success_message: string
  privacy_note?: string
}

export interface FooterData {
  agency_name?: string
  agency_registration?: string
  phone?: string
  email?: string
  whatsapp?: string
  instagram?: string
  disclaimer?: string
}

export type BlockDataMap = {
  'hero': HeroData
  'hero-split': HeroSplitData
  'features-grid': FeaturesGridData
  'amenities-chips': AmenitiesChipsData
  'gallery': GalleryData
  'benefits-list': BenefitsListData
  'lead-form': LeadFormData
  'footer': FooterData
}

export type Block<T extends BlockType = BlockType> = {
  id: string
  type: T
  visible: boolean
  data: BlockDataMap[T]
}

export type LandingKind = 'lead_capture' | 'property'
export type LandingStatus = 'draft' | 'pending_review' | 'published' | 'archived'

export interface LeadRules {
  assigned_agent_id?: string
  tags?: string[]
  campaign?: string
  notify_channels?: Array<'email' | 'whatsapp'>
}

export interface Landing {
  id: string
  org_id: string
  agent_id: string
  template_id: string
  kind: LandingKind
  slug_base: string
  slug_suffix: string
  full_slug: string
  status: LandingStatus
  blocks: Block[]
  brand_voice: string | null
  lead_rules: LeadRules | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_version_id: string | null
  published_at: string | null
  published_by: string | null
  last_review_note: string | null
  created_at: string
  updated_at: string
}

export interface LandingTemplate {
  id: string
  org_id: string | null
  name: string
  kind: LandingKind
  description: string | null
  preview_image_url: string | null
  blocks: Block[]
  active: boolean
  sort_order: number
}

export interface LandingVersion {
  id: string
  landing_id: string
  version_number: number
  blocks: Block[]
  label: 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'
  created_by: string
  created_at: string
}

export interface AnalyticsSummary {
  pageviews: number
  unique_visitors: number
  cta_clicks: number
  form_starts: number
  form_submits: number
  conversion_rate: number
  pageviews_by_day: Array<{ date: string; count: number }>
  top_utm_sources: Array<{ source: string; count: number }>
}
```

- [ ] **Step 2: API wrappers**

Create `vendepro-frontend/src/lib/landings/api.ts`:

```typescript
import { apiFetch } from '@/lib/api'
import type { Block, Landing, LandingTemplate, LandingVersion, AnalyticsSummary, LandingKind, LandingStatus, LeadRules } from './types'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

export const landingsApi = {
  async list(params: { scope?: 'mine' | 'org' | 'pending_review'; kind?: LandingKind; status?: LandingStatus }) {
    const q = new URLSearchParams()
    if (params.scope) q.set('scope', params.scope)
    if (params.kind) q.set('kind', params.kind)
    if (params.status) q.set('status', params.status)
    const res = await apiFetch('crm', `/landings?${q.toString()}`)
    return json<{ landings: Landing[] }>(res)
  },

  async get(id: string) {
    const res = await apiFetch('crm', `/landings/${id}`)
    return json<{ landing: Landing }>(res)
  },

  async create(body: { templateId: string; slugBase: string; brandVoice?: string; leadRules?: LeadRules; seoTitle?: string; seoDescription?: string; ogImageUrl?: string }) {
    const res = await apiFetch('crm', `/landings`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    return json<{ landingId: string; fullSlug: string }>(res)
  },

  async updateMetadata(id: string, patch: Partial<Pick<Landing, 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'slug_base'>>) {
    const res = await apiFetch('crm', `/landings/${id}`, { method: 'PATCH', body: JSON.stringify({ patch }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async updateBlocks(id: string, blocks: Block[], label: 'manual-save' | 'auto-save' = 'manual-save') {
    const res = await apiFetch('crm', `/landings/${id}/blocks`, { method: 'PATCH', body: JSON.stringify({ blocks, label }), headers: { 'Content-Type': 'application/json' } })
    return json<{ versionId: string; versionNumber: number }>(res)
  },

  async addBlock(id: string, block: Omit<Block, 'id'>, insertAtIndex?: number) {
    const res = await apiFetch('crm', `/landings/${id}/blocks`, { method: 'POST', body: JSON.stringify({ block, insertAtIndex }), headers: { 'Content-Type': 'application/json' } })
    return json<{ blockId: string }>(res)
  },

  async removeBlock(id: string, blockId: string) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/${blockId}`, { method: 'DELETE' })
    return json<{ ok: true }>(res)
  },

  async reorderBlocks(id: string, orderedBlockIds: string[]) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/reorder`, { method: 'POST', body: JSON.stringify({ orderedBlockIds }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async toggleVisibility(id: string, blockId: string, visible: boolean) {
    const res = await apiFetch('crm', `/landings/${id}/blocks/${blockId}/visibility`, { method: 'PATCH', body: JSON.stringify({ visible }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async listVersions(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/versions`)
    return json<{ versions: LandingVersion[] }>(res)
  },

  async rollback(id: string, versionId: string) {
    const res = await apiFetch('crm', `/landings/${id}/rollback/${versionId}`, { method: 'POST' })
    return json<{ versionNumber: number }>(res)
  },

  async requestPublish(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/request-publish`, { method: 'POST' })
    return json<{ ok: true }>(res)
  },

  async publish(id: string) {
    const res = await apiFetch('crm', `/landings/${id}/publish`, { method: 'POST' })
    return json<{ versionId: string }>(res)
  },

  async rejectPublish(id: string, note?: string) {
    const res = await apiFetch('crm', `/landings/${id}/reject-publish`, { method: 'POST', body: JSON.stringify({ note }), headers: { 'Content-Type': 'application/json' } })
    return json<{ ok: true }>(res)
  },

  async archive(id: string) { return json(await apiFetch('crm', `/landings/${id}/archive`, { method: 'POST' })) },
  async unarchive(id: string) { return json(await apiFetch('crm', `/landings/${id}/unarchive`, { method: 'POST' })) },

  async analytics(id: string, rangeDays: 7 | 14 | 30) {
    const res = await apiFetch('crm', `/landings/${id}/analytics?rangeDays=${rangeDays}`)
    return json<{ summary: AnalyticsSummary }>(res)
  },
}

export const templatesApi = {
  async list(kind?: LandingKind) {
    const q = kind ? `?kind=${kind}` : ''
    const res = await apiFetch('crm', `/landing-templates${q}`)
    return json<{ templates: LandingTemplate[] }>(res)
  },
}

export const aiApi = {
  async editBlock(landingId: string, body: { prompt: string; scope: 'block' | 'global'; blockId?: string }) {
    const res = await apiFetch('ai', `/landings/${landingId}/edit-block`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
    return json<
      | { status: 'ok'; proposal: { kind: 'block'; blockId: string; blockType: string; data: any } | { kind: 'global'; blocks: Block[] } }
      | { status: 'error'; reason: string; detail?: string }
    >(res)
  },
}
```

- [ ] **Step 3: Slug helpers (client-side)**

Create `vendepro-frontend/src/lib/landings/slug.ts`:

```typescript
export function slugifyBase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function isValidSlugBase(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s) && s.length >= 3 && s.length <= 60
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: no errors.

```bash
git add vendepro-frontend/src/lib/landings/
git commit -m "feat(frontend): landings types + API client + slug helpers"
```

---

## Task 2: 8 Block components (public + editor mode)

**Files:**
- Create: `vendepro-frontend/src/components/landings/blocks/HeroBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/HeroSplitBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/FeaturesGridBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/AmenitiesChipsBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/GalleryBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/BenefitsListBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/LeadFormBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/FooterBlock.tsx`
- Create: `vendepro-frontend/src/components/landings/blocks/index.ts`

Cada bloque recibe `{ data, mode }`. `mode='public'` renderiza limpio. `mode='editor'` también es visual igual — el overlay de selección lo pone el `BlockRenderer` afuera, no el componente en sí. Los forms de lead-form en `mode='editor'` están deshabilitados (no envían) para evitar triggering durante edición.

- [ ] **Step 1: HeroBlock**

Create `vendepro-frontend/src/components/landings/blocks/HeroBlock.tsx`:

```tsx
import type { HeroData } from '@/lib/landings/types'

interface Props { data: HeroData; mode?: 'public' | 'editor' }

export default function HeroBlock({ data }: Props) {
  return (
    <section
      className="relative flex items-end min-h-[420px] md:min-h-[520px] bg-center bg-cover text-white"
      style={{ backgroundImage: `url(${data.background_image_url})` }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/10 to-black"
        style={{ opacity: data.overlay_opacity }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-12 md:pb-20">
        {data.eyebrow && (
          <p className="text-xs md:text-sm uppercase tracking-widest font-semibold mb-3 opacity-90">{data.eyebrow}</p>
        )}
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-3">{data.title}</h1>
        {data.subtitle && <p className="text-base md:text-lg opacity-90 mb-6 max-w-2xl">{data.subtitle}</p>}
        {data.cta && (
          <a
            href={data.cta.href}
            className="inline-block bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-7 py-3 rounded-full transition-colors"
          >
            {data.cta.label}
          </a>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: HeroSplitBlock**

Create `vendepro-frontend/src/components/landings/blocks/HeroSplitBlock.tsx`:

```tsx
import type { HeroSplitData } from '@/lib/landings/types'

const ACCENTS = {
  pink:   'bg-[#ff007c] hover:bg-[#e60070] text-white',
  orange: 'bg-[#ff8017] hover:bg-[#e6720f] text-white',
  dark:   'bg-gray-900 hover:bg-black text-white',
} as const

export default function HeroSplitBlock({ data }: { data: HeroSplitData; mode?: 'public' | 'editor' }) {
  const leftOrder = data.media_side === 'right' ? 'order-1 md:order-1' : 'order-1 md:order-2'
  const rightOrder = data.media_side === 'right' ? 'order-2 md:order-2' : 'order-2 md:order-1'
  return (
    <section className="grid md:grid-cols-2 bg-white">
      <div className={`${leftOrder} flex flex-col justify-center px-6 md:px-12 py-12 md:py-20`}>
        {data.eyebrow && <p className="text-xs uppercase tracking-widest font-semibold text-[#ff007c] mb-3">{data.eyebrow}</p>}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight text-gray-900 mb-4">{data.title}</h1>
        {data.subtitle && <p className="text-base text-gray-600 mb-6 max-w-lg">{data.subtitle}</p>}
        {data.cta && (
          <a href={data.cta.href} className={`inline-block rounded-full px-6 py-3 font-semibold self-start ${ACCENTS[data.accent_color]}`}>
            {data.cta.label}
          </a>
        )}
      </div>
      <div className={`${rightOrder} min-h-[260px] md:min-h-[420px] bg-center bg-cover`}
        style={{ backgroundImage: `url(${data.media_url})` }}
        aria-hidden="true"
      />
    </section>
  )
}
```

- [ ] **Step 3: FeaturesGridBlock**

Create `vendepro-frontend/src/components/landings/blocks/FeaturesGridBlock.tsx`:

```tsx
import * as Icons from 'lucide-react'
import type { FeaturesGridData } from '@/lib/landings/types'

function iconFor(name: string) {
  const C = (Icons as any)[name]
  return typeof C === 'function' ? C : Icons.Star
}

export default function FeaturesGridBlock({ data }: { data: FeaturesGridData; mode?: 'public' | 'editor' }) {
  const cols = data.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
  return (
    <section className="bg-white py-14 md:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {data.title && <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">{data.title}</h2>}
        {data.subtitle && <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">{data.subtitle}</p>}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-6`}>
          {data.items.map((item, i) => {
            const Icon = iconFor(item.icon)
            return (
              <div key={i} className="bg-gray-50 rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-[#ff007c]/10 flex items-center justify-center text-[#ff007c] mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: AmenitiesChipsBlock**

Create `vendepro-frontend/src/components/landings/blocks/AmenitiesChipsBlock.tsx`:

```tsx
import type { AmenitiesChipsData } from '@/lib/landings/types'

export default function AmenitiesChipsBlock({ data }: { data: AmenitiesChipsData; mode?: 'public' | 'editor' }) {
  return (
    <section className="bg-gray-50 py-12 md:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {data.title && <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6 text-center">{data.title}</h2>}
        <div className="flex flex-wrap gap-2.5 justify-center">
          {data.chips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm text-sm text-gray-800 font-medium">
              {chip.emoji && <span aria-hidden="true">{chip.emoji}</span>}
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: GalleryBlock**

Create `vendepro-frontend/src/components/landings/blocks/GalleryBlock.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { GalleryData } from '@/lib/landings/types'

export default function GalleryBlock({ data }: { data: GalleryData; mode?: 'public' | 'editor' }) {
  const [active, setActive] = useState(0)
  if (data.images.length === 0) return null

  if (data.layout === 'carousel') {
    return (
      <section className="bg-white py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="aspect-[16/9] bg-gray-100 rounded-2xl overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${data.images[active].url})` }} aria-label={data.images[active].alt ?? ''} />
          <div className="flex gap-2 overflow-x-auto mt-3">
            {data.images.map((img, i) => (
              <button key={i} onClick={() => setActive(i)} className={`flex-shrink-0 w-20 h-14 rounded-lg bg-cover bg-center border-2 transition-colors ${i === active ? 'border-[#ff007c]' : 'border-transparent'}`}
                style={{ backgroundImage: `url(${img.url})` }} aria-label={`Foto ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (data.layout === 'mosaic') {
    const [first, ...rest] = data.images
    return (
      <section className="bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-3 grid-rows-2 gap-2 aspect-[16/9]">
          <div className="col-span-2 row-span-2 bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${first.url})` }} />
          {rest.slice(0, 4).map((img, i) => (
            <div key={i} className="bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${img.url})` }} />
          ))}
        </div>
      </section>
    )
  }

  // grid
  return (
    <section className="bg-white py-10 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.images.map((img, i) => (
          <div key={i} className="aspect-square bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${img.url})` }} aria-label={img.alt ?? ''} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: BenefitsListBlock**

Create `vendepro-frontend/src/components/landings/blocks/BenefitsListBlock.tsx`:

```tsx
import { Check } from 'lucide-react'
import type { BenefitsListData } from '@/lib/landings/types'

export default function BenefitsListBlock({ data }: { data: BenefitsListData; mode?: 'public' | 'editor' }) {
  return (
    <section className="bg-white py-14 px-6">
      <div className="max-w-3xl mx-auto">
        {data.title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">{data.title}</h2>}
        <div className="space-y-5">
          {data.items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#ff007c]/10 flex items-center justify-center text-[#ff007c] flex-shrink-0">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-0.5">{item.title}</h3>
                {item.description && <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: LeadFormBlock**

Create `vendepro-frontend/src/components/landings/blocks/LeadFormBlock.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { LeadFormData } from '@/lib/landings/types'

interface Props {
  data: LeadFormData
  mode?: 'public' | 'editor'
  onSubmit?: (values: Record<string, string>) => Promise<void>   // Fase C lo conecta; si no, el form es no-op
}

export default function LeadFormBlock({ data, mode, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'editor') return
    if (!onSubmit) return
    setLoading(true); setError(null)
    try {
      await onSubmit(values)
      setSuccess(data.success_message)
    } catch (err: any) {
      setError(err.message ?? 'No pudimos enviar tu consulta. Probá de nuevo.')
    } finally { setLoading(false) }
  }

  return (
    <section id="form" className="bg-gradient-to-br from-[#ff007c] to-[#ff8017] py-14 px-6 text-white">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{data.title}</h2>
        {data.subtitle && <p className="opacity-90 mb-6">{data.subtitle}</p>}

        {success ? (
          <div className="bg-white text-gray-900 rounded-2xl p-6 text-center">
            <p className="font-medium">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" aria-disabled={mode === 'editor'}>
            {data.fields.map((field) => (
              <div key={field.key}>
                <label className="sr-only" htmlFor={`f_${field.key}`}>{field.label}</label>
                <input
                  id={`f_${field.key}`}
                  type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'}
                  placeholder={field.label + (field.required ? ' *' : '')}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  required={field.required}
                  disabled={mode === 'editor'}
                  className="w-full rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 px-4 py-3 outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            ))}
            {data.fields.some(f => f.key === 'message') ? null : null}
            {error && <p className="text-sm bg-white/15 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading || mode === 'editor'} className="w-full bg-white text-[#ff007c] font-semibold rounded-full py-3 hover:bg-white/95 disabled:opacity-70">
              {loading ? 'Enviando…' : data.submit_label}
            </button>
            {data.privacy_note && <p className="text-xs opacity-80 text-center mt-2">{data.privacy_note}</p>}
          </form>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 8: FooterBlock**

Create `vendepro-frontend/src/components/landings/blocks/FooterBlock.tsx`:

```tsx
import { Phone, Mail, MessageCircle, Instagram } from 'lucide-react'
import type { FooterData } from '@/lib/landings/types'

export default function FooterBlock({ data }: { data: FooterData; mode?: 'public' | 'editor' }) {
  return (
    <footer className="bg-white border-t border-gray-200 py-10 px-6 text-center text-sm text-gray-600">
      <div className="max-w-4xl mx-auto space-y-3">
        {data.agency_name && <p className="font-semibold text-gray-900">{data.agency_name}</p>}
        {data.agency_registration && <p className="text-xs text-gray-500">{data.agency_registration}</p>}
        <div className="flex flex-wrap gap-4 justify-center text-gray-700">
          {data.phone && <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Phone className="w-4 h-4" />{data.phone}</a>}
          {data.email && <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Mail className="w-4 h-4" />{data.email}</a>}
          {data.whatsapp && <a href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><MessageCircle className="w-4 h-4" />{data.whatsapp}</a>}
          {data.instagram && <a href={`https://instagram.com/${data.instagram.replace('@', '')}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-[#ff007c]"><Instagram className="w-4 h-4" />{data.instagram}</a>}
        </div>
        {data.disclaimer && <p className="text-xs text-gray-400 pt-4 border-t border-gray-100 max-w-2xl mx-auto">{data.disclaimer}</p>}
      </div>
    </footer>
  )
}
```

- [ ] **Step 9: Registry index**

Create `vendepro-frontend/src/components/landings/blocks/index.ts`:

```typescript
import HeroBlock from './HeroBlock'
import HeroSplitBlock from './HeroSplitBlock'
import FeaturesGridBlock from './FeaturesGridBlock'
import AmenitiesChipsBlock from './AmenitiesChipsBlock'
import GalleryBlock from './GalleryBlock'
import BenefitsListBlock from './BenefitsListBlock'
import LeadFormBlock from './LeadFormBlock'
import FooterBlock from './FooterBlock'
import type { BlockType } from '@/lib/landings/types'
import type { ComponentType } from 'react'

export const BLOCK_COMPONENTS: Record<BlockType, ComponentType<any>> = {
  'hero': HeroBlock,
  'hero-split': HeroSplitBlock,
  'features-grid': FeaturesGridBlock,
  'amenities-chips': AmenitiesChipsBlock,
  'gallery': GalleryBlock,
  'benefits-list': BenefitsListBlock,
  'lead-form': LeadFormBlock,
  'footer': FooterBlock,
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  'hero': 'Hero',
  'hero-split': 'Hero dividido',
  'features-grid': 'Grid de features',
  'amenities-chips': 'Amenities',
  'gallery': 'Galería',
  'benefits-list': 'Beneficios',
  'lead-form': 'Formulario',
  'footer': 'Footer',
}

export { HeroBlock, HeroSplitBlock, FeaturesGridBlock, AmenitiesChipsBlock, GalleryBlock, BenefitsListBlock, LeadFormBlock, FooterBlock }
```

- [ ] **Step 10: Typecheck + commit**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: no errors.

```bash
git add vendepro-frontend/src/components/landings/blocks/
git commit -m "feat(landings): 8 block components (public + editor modes)"
```

---

## Task 3: BlockRenderer + StatusBadge

**Files:**
- Create: `vendepro-frontend/src/components/landings/BlockRenderer.tsx`
- Create: `vendepro-frontend/src/components/landings/StatusBadge.tsx`

- [ ] **Step 1: BlockRenderer**

Create `vendepro-frontend/src/components/landings/BlockRenderer.tsx`:

```tsx
'use client'
import type { Block } from '@/lib/landings/types'
import { BLOCK_COMPONENTS, BLOCK_LABELS } from './blocks'

interface Props {
  blocks: Block[]
  mode?: 'public' | 'editor'
  selectedBlockId?: string | null
  onSelect?: (blockId: string) => void
  onFormSubmit?: (values: Record<string, string>) => Promise<void>
}

export default function BlockRenderer({ blocks, mode = 'public', selectedBlockId, onSelect, onFormSubmit }: Props) {
  const visible = mode === 'public' ? blocks.filter(b => b.visible) : blocks

  return (
    <div className="w-full" data-mode={mode}>
      {visible.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type]
        const isSelected = selectedBlockId === block.id
        const extraProps = block.type === 'lead-form' ? { onSubmit: onFormSubmit } : {}

        if (mode === 'public') {
          return block.visible ? <div key={block.id}><Component data={block.data} mode="public" {...extraProps} /></div> : null
        }

        // Editor mode: wrap with selection overlay + click handler
        return (
          <div
            key={block.id}
            className={`relative group transition-colors ${!block.visible ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-[#ff007c] ring-offset-2' : 'hover:ring-2 hover:ring-[#ff007c]/30'}`}
            onClick={(e) => { e.stopPropagation(); onSelect?.(block.id) }}
            role="button"
            tabIndex={0}
            aria-label={`Bloque ${BLOCK_LABELS[block.type]}`}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 z-20 bg-[#ff007c] text-white text-[10px] font-semibold px-2 py-1 rounded-md tracking-wider uppercase">
                {BLOCK_LABELS[block.type]} · editando
              </span>
            )}
            <Component data={block.data} mode="editor" {...extraProps} />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: StatusBadge**

Create `vendepro-frontend/src/components/landings/StatusBadge.tsx`:

```tsx
import type { LandingStatus } from '@/lib/landings/types'

const STYLES: Record<LandingStatus, { bg: string; text: string; label: string }> = {
  'draft':          { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Borrador' },
  'pending_review': { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En revisión' },
  'published':      { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Publicada' },
  'archived':       { bg: 'bg-gray-200', text: 'text-gray-500', label: 'Archivada' },
}

export default function StatusBadge({ status }: { status: LandingStatus }) {
  const s = STYLES[status]
  return <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
git add vendepro-frontend/src/components/landings/BlockRenderer.tsx vendepro-frontend/src/components/landings/StatusBadge.tsx
git commit -m "feat(landings): BlockRenderer with editor click-to-edit overlay + StatusBadge"
```

---

## Task 4: Navigation + Landings list page

**Files:**
- Modify: `vendepro-frontend/src/lib/nav-config.ts`
- Create: `vendepro-frontend/src/app/(dashboard)/landings/page.tsx`
- Create: `vendepro-frontend/src/app/(dashboard)/landings/loading.tsx`
- Create: `vendepro-frontend/src/components/landings/LandingCard.tsx`

- [ ] **Step 1: Agregar nav item**

Modify `vendepro-frontend/src/lib/nav-config.ts` — importar `Globe` de lucide y agregar item bajo la sección correspondiente (ubicar junto a "Calendario" o "Contactos" según preferencia):

```typescript
import { /* ...existing... */ Globe } from 'lucide-react'
```

Dentro de `menuSections` (sección "Principal" o similar) agregar al array de links:

```typescript
{ href: '/landings', label: 'Landings', icon: Globe },
```

- [ ] **Step 2: LandingCard**

Create `vendepro-frontend/src/components/landings/LandingCard.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { ExternalLink, MoreHorizontal, Archive, Copy } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import StatusBadge from './StatusBadge'

export default function LandingCard({ landing }: { landing: Landing }) {
  const publicUrl = `https://${landing.full_slug}.landings.vendepro.com.ar`
  const kindLabel = landing.kind === 'lead_capture' ? 'Captación' : 'Propiedad'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/landings/${landing.id}`} className="block">
        <div className="h-36 bg-gradient-to-br from-[#ff007c]/10 to-[#ff8017]/10 flex items-center justify-center text-gray-400">
          {landing.og_image_url
            ? <img src={landing.og_image_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs uppercase tracking-wider">Sin preview</span>}
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-1">{landing.seo_title || landing.full_slug}</h3>
            <StatusBadge status={landing.status} />
          </div>
          <p className="text-xs text-gray-500 truncate">{landing.full_slug}.landings.vendepro.com.ar</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-0.5 rounded-md bg-gray-100">{kindLabel}</span>
            <span>{new Date(landing.updated_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
      </Link>
      <div className="px-4 pb-4 flex items-center gap-2">
        {landing.status === 'published' && (
          <a href={publicUrl} target="_blank" rel="noopener" className="text-xs text-[#ff007c] hover:underline inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Ver pública
          </a>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Listing page**

Create `vendepro-frontend/src/app/(dashboard)/landings/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import LandingCard from '@/components/landings/LandingCard'
import NewLandingModal from '@/components/landings/NewLandingModal'
import { getCurrentUser } from '@/lib/auth'

type Tab = 'mine' | 'org' | 'pending_review'

export default function LandingsPage() {
  const [landings, setLandings] = useState<Landing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('mine')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  useEffect(() => {
    let alive = true
    setLoading(true)
    landingsApi.list({ scope: tab })
      .then(r => { if (alive) setLandings(r.landings) })
      .catch(() => { if (alive) setLandings([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [tab])

  const filtered = landings.filter(l =>
    !search || l.full_slug.includes(search.toLowerCase()) || (l.seo_title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Landings</h1>
          <p className="text-sm text-gray-500 mt-1">Creá landings con IA a partir de templates curados.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-5 py-2.5 rounded-full"
        >
          <Plus className="w-4 h-4" /> Nueva landing
        </button>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200 mb-6">
        <button onClick={() => setTab('mine')} className={`pb-3 px-1 text-sm font-medium ${tab === 'mine' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          Mías
        </button>
        {isAdmin && (
          <>
            <button onClick={() => setTab('org')} className={`pb-3 px-1 text-sm font-medium ${tab === 'org' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Todas del org
            </button>
            <button onClick={() => setTab('pending_review')} className={`pb-3 px-1 text-sm font-medium ${tab === 'pending_review' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              Pendientes de aprobación
            </button>
          </>
        )}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por slug o título…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-[#ff007c]"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <p className="text-gray-500">Todavía no hay landings acá.</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 text-[#ff007c] font-medium">Crear la primera</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(l => <LandingCard key={l.id} landing={l} />)}
        </div>
      )}

      {showCreate && <NewLandingModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

Create `vendepro-frontend/src/app/(dashboard)/landings/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="p-8 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40 mb-6"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build + manual verify**

Run: `cd vendepro-frontend && npx tsc --noEmit && npm run build`
Expected: build OK. (NewLandingModal se implementa en Task 5 — si falla la build por eso, seguir al Task 5 primero).

**Si fallara:** comentar la importación y uso de `NewLandingModal` temporalmente, completar Task 5, luego descomentar.

- [ ] **Step 5: Commit**

```bash
git add vendepro-frontend/src/lib/nav-config.ts vendepro-frontend/src/app/\(dashboard\)/landings/ vendepro-frontend/src/components/landings/LandingCard.tsx
git commit -m "feat(landings): listing page with tabs (mine/org/pending) and cards"
```

---

## Task 5: New Landing Modal (Wizard 2 steps)

**Files:**
- Create: `vendepro-frontend/src/components/landings/NewLandingModal.tsx`
- Create: `vendepro-frontend/src/components/landings/TemplatePickerModal.tsx`

- [ ] **Step 1: Template picker + wizard**

Create `vendepro-frontend/src/components/landings/NewLandingModal.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, Loader2 } from 'lucide-react'
import { templatesApi, landingsApi } from '@/lib/landings/api'
import type { LandingTemplate, LandingKind } from '@/lib/landings/types'
import { slugifyBase, isValidSlugBase } from '@/lib/landings/slug'

type Step = 'template' | 'name'

export default function NewLandingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('template')
  const [templates, setTemplates] = useState<LandingTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<LandingTemplate | null>(null)
  const [kindFilter, setKindFilter] = useState<LandingKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [slugBase, setSlugBase] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    templatesApi.list().then(r => setTemplates(r.templates)).finally(() => setLoading(false))
  }, [])

  const filtered = kindFilter === 'all' ? templates : templates.filter(t => t.kind === kindFilter)

  async function submit() {
    if (!selectedTemplate) return
    const normalized = slugifyBase(slugBase)
    if (!isValidSlugBase(normalized)) {
      setError('El slug debe tener 3-60 caracteres, solo letras, números y guiones.')
      return
    }
    setCreating(true); setError(null)
    try {
      const r = await landingsApi.create({ templateId: selectedTemplate.id, slugBase: normalized })
      router.push(`/landings/${r.landingId}`)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo crear la landing.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Nueva landing</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 text-sm">
          <span className={`font-medium ${step === 'template' ? 'text-[#ff007c]' : 'text-gray-400'}`}>1. Elegí un template</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <span className={`font-medium ${step === 'name' ? 'text-[#ff007c]' : 'text-gray-400'}`}>2. Nombrala</span>
        </div>

        {step === 'template' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-2 mb-4">
              {(['all', 'lead_capture', 'property'] as const).map(k => (
                <button key={k} onClick={() => setKindFilter(k)} className={`px-3 py-1.5 rounded-full text-sm ${kindFilter === k ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {k === 'all' ? 'Todos' : k === 'lead_capture' ? 'Captación' : 'Propiedad'}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Cargando templates…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplate(t); setStep('name') }}
                    className="text-left bg-white border border-gray-200 hover:border-[#ff007c] rounded-2xl overflow-hidden transition-colors">
                    <div className="aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                      {t.preview_image_url ? <img src={t.preview_image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">Sin preview</span>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{t.kind === 'lead_capture' ? 'Captación' : 'Propiedad'}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
                      {t.description && <p className="text-sm text-gray-600 line-clamp-2">{t.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'name' && selectedTemplate && (
          <div className="flex-1 overflow-auto p-6">
            <p className="text-sm text-gray-500 mb-6">Template elegido: <strong className="text-gray-900">{selectedTemplate.name}</strong></p>

            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre / slug de la landing</label>
            <input
              autoFocus
              value={slugBase}
              onChange={e => setSlugBase(e.target.value)}
              placeholder="ej: palermo-soho"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff007c]"
            />
            {slugBase && (
              <p className="mt-2 text-xs text-gray-500">
                URL final: <code>{slugifyBase(slugBase) || 'slug'}-XXXXX.landings.vendepro.com.ar</code> (se agrega un sufijo aleatorio de 5 chars)
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between mt-8">
              <button onClick={() => setStep('template')} className="text-sm text-gray-600 hover:text-gray-900">← Volver</button>
              <button onClick={submit} disabled={creating || !slugBase.trim()}
                className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-6 py-2.5 rounded-full disabled:opacity-60">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creando…</> : 'Crear landing'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/NewLandingModal.tsx
git commit -m "feat(landings): wizard modal 2-steps (template picker + slug)"
```

---

## Task 6: Editor shell + toolbar + layout 3-panes

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/landings/[id]/page.tsx`
- Create: `vendepro-frontend/src/components/landings/EditorToolbar.tsx`

- [ ] **Step 1: Toolbar**

Create `vendepro-frontend/src/components/landings/EditorToolbar.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, History, Settings, Eye, Send, CheckCircle2, XCircle } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import StatusBadge from './StatusBadge'

interface Props {
  landing: Landing
  isAdmin: boolean
  dirty: boolean
  saving: boolean
  onOpenVersions: () => void
  onOpenConfig: () => void
  onOpenPreview: () => void
  onRequestPublish: () => Promise<void>
  onPublish: () => Promise<void>
  onRejectPublish: (note: string) => Promise<void>
}

export default function EditorToolbar({ landing, isAdmin, dirty, saving, onOpenVersions, onOpenConfig, onOpenPreview, onRequestPublish, onPublish, onRejectPublish }: Props) {
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  async function handle(fn: () => Promise<void>) {
    setBusy(true); try { await fn() } finally { setBusy(false) }
  }

  return (
    <header className="h-14 px-4 flex items-center gap-4 bg-white border-b border-gray-200 sticky top-0 z-30">
      <Link href="/landings" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-900 truncate">{landing.seo_title || landing.full_slug}</h1>
          <StatusBadge status={landing.status} />
          {saving && <span className="text-xs text-gray-500">Guardando…</span>}
          {!saving && dirty && <span className="text-xs text-amber-600">Sin guardar</span>}
        </div>
        <p className="text-xs text-gray-500 truncate">{landing.full_slug}.landings.vendepro.com.ar</p>
      </div>

      <button onClick={onOpenVersions} className="p-2 hover:bg-gray-100 rounded-lg" title="Versiones"><History className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onOpenConfig} className="p-2 hover:bg-gray-100 rounded-lg" title="Configuración"><Settings className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onOpenPreview} className="p-2 hover:bg-gray-100 rounded-lg" title="Vista previa"><Eye className="w-4 h-4 text-gray-600" /></button>

      {landing.status === 'draft' && !isAdmin && (
        <button onClick={() => handle(onRequestPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60">
          <Send className="w-4 h-4" /> Solicitar publicación
        </button>
      )}
      {landing.status === 'draft' && isAdmin && (
        <button onClick={() => handle(onPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60">
          <CheckCircle2 className="w-4 h-4" /> Publicar
        </button>
      )}
      {landing.status === 'pending_review' && isAdmin && (
        <div className="flex items-center gap-2">
          <button onClick={() => handle(onPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-full">
            <CheckCircle2 className="w-4 h-4" /> Aprobar y publicar
          </button>
          <button onClick={() => setShowReject(true)} className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-50">
            <XCircle className="w-4 h-4" /> Rechazar
          </button>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReject(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Rechazar solicitud</h3>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota para el agente (opcional)…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:border-[#ff007c]" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-full">Cancelar</button>
              <button onClick={() => { handle(() => onRejectPublish(note)); setShowReject(false) }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-full">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
```

- [ ] **Step 2: Editor page shell**

Create `vendepro-frontend/src/app/(dashboard)/landings/[id]/page.tsx`:

```tsx
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { Landing, Block } from '@/lib/landings/types'
import { landingsApi } from '@/lib/landings/api'
import { getCurrentUser } from '@/lib/auth'
import BlockRenderer from '@/components/landings/BlockRenderer'
import BlockListSidebar from '@/components/landings/BlockListSidebar'
import InspectorPanel from '@/components/landings/InspectorPanel'
import AIChatPanel from '@/components/landings/AIChatPanel'
import EditorToolbar from '@/components/landings/EditorToolbar'
import VersionsDrawer from '@/components/landings/VersionsDrawer'
import ConfigDrawer from '@/components/landings/ConfigDrawer'
import PublishReviewBanner from '@/components/landings/PublishReviewBanner'

export default function LandingEditorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const user = typeof window !== 'undefined' ? getCurrentUser() : null
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [landing, setLanding] = useState<Landing | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'inspector' | 'ai'>('inspector')
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const saveTimer = useRef<any>(null)

  useEffect(() => {
    landingsApi.get(params.id).then(r => {
      setLanding(r.landing)
      setBlocks(r.landing.blocks)
      setSelectedId(r.landing.blocks[0]?.id ?? null)
    })
  }, [params.id])

  // Auto-save throttled (30s)
  useEffect(() => {
    if (!dirty || !landing) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await landingsApi.updateBlocks(landing.id, blocks, 'auto-save')
        setDirty(false)
      } finally { setSaving(false) }
    }, 30000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [dirty, blocks, landing])

  const updateBlock = useCallback((blockId: string, patch: Partial<Block['data']>) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, data: { ...b.data, ...patch } } as Block : b))
    setDirty(true)
  }, [])

  const selectedBlock = useMemo(() => blocks.find(b => b.id === selectedId) ?? null, [blocks, selectedId])

  async function manualSave() {
    if (!landing) return
    setSaving(true)
    try { await landingsApi.updateBlocks(landing.id, blocks, 'manual-save'); setDirty(false) }
    finally { setSaving(false) }
  }

  async function refresh() {
    if (!landing) return
    const r = await landingsApi.get(landing.id)
    setLanding(r.landing); setBlocks(r.landing.blocks); setDirty(false)
  }

  if (!landing) return <div className="p-12 text-center text-gray-500">Cargando editor…</div>

  const viewportClass = viewport === 'mobile' ? 'max-w-[420px]' : 'max-w-5xl'

  return (
    <div className="h-[calc(100vh-0px)] flex flex-col bg-gray-50">
      <EditorToolbar
        landing={landing} isAdmin={isAdmin} dirty={dirty} saving={saving}
        onOpenVersions={() => setShowVersions(true)}
        onOpenConfig={() => setShowConfig(true)}
        onOpenPreview={() => window.open(`/landings/${landing.id}/preview`, '_blank')}
        onRequestPublish={async () => { await manualSave(); await landingsApi.requestPublish(landing.id); await refresh() }}
        onPublish={async () => { await manualSave(); await landingsApi.publish(landing.id); await refresh() }}
        onRejectPublish={async (note) => { await landingsApi.rejectPublish(landing.id, note); await refresh() }}
      />

      {landing.status === 'draft' && landing.last_review_note && <PublishReviewBanner note={landing.last_review_note} />}

      <div className="flex-1 grid grid-cols-[240px_1fr_340px] min-h-0">
        <BlockListSidebar
          blocks={blocks}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={(ordered) => { setBlocks(ordered); setDirty(true) }}
          onRemove={async (bid) => { await landingsApi.removeBlock(landing.id, bid); await refresh() }}
          onToggleVisibility={(bid, v) => {
            setBlocks(prev => prev.map(b => b.id === bid ? { ...b, visible: v } : b))
            setDirty(true)
          }}
          onAdd={async (block) => { await landingsApi.addBlock(landing.id, block); await refresh() }}
        />

        <div className="flex flex-col bg-gray-100 overflow-hidden">
          <div className="flex gap-2 justify-center p-2 border-b border-gray-200 bg-white">
            <button onClick={() => setViewport('mobile')} className={`text-xs px-3 py-1.5 rounded-md ${viewport === 'mobile' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>📱 Móvil</button>
            <button onClick={() => setViewport('desktop')} className={`text-xs px-3 py-1.5 rounded-md ${viewport === 'desktop' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>💻 Desktop</button>
            <span className="mx-2 w-px bg-gray-200" />
            <button onClick={manualSave} disabled={!dirty || saving} className="text-xs px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50">Guardar</button>
          </div>
          <div className="flex-1 overflow-auto py-6 px-4">
            <div className={`mx-auto bg-white rounded-2xl shadow-md overflow-hidden ${viewportClass}`}>
              <BlockRenderer
                blocks={blocks}
                mode="editor"
                selectedBlockId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        </div>

        <aside className="bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button onClick={() => setRightTab('inspector')} className={`flex-1 py-3 text-sm font-medium ${rightTab === 'inspector' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500'}`}>Inspector</button>
            <button onClick={() => setRightTab('ai')} className={`flex-1 py-3 text-sm font-medium ${rightTab === 'ai' ? 'border-b-2 border-[#ff007c] text-gray-900' : 'text-gray-500'}`}>✨ Chat IA</button>
          </div>
          <div className="flex-1 overflow-auto">
            {rightTab === 'inspector' && selectedBlock && (
              <InspectorPanel block={selectedBlock} onChange={(patch) => updateBlock(selectedBlock.id, patch)} />
            )}
            {rightTab === 'ai' && (
              <AIChatPanel
                landingId={landing.id}
                selectedBlockId={selectedId}
                onProposalAccepted={async () => { await refresh() }}
              />
            )}
          </div>
        </aside>
      </div>

      {showVersions && <VersionsDrawer landingId={landing.id} onClose={() => setShowVersions(false)} onRollback={refresh} />}
      {showConfig && <ConfigDrawer landing={landing} onClose={() => setShowConfig(false)} onSaved={refresh} />}
    </div>
  )
}
```

- [ ] **Step 3: Build + commit (placeholder children allowed — serán reemplazados)**

```bash
git add vendepro-frontend/src/components/landings/EditorToolbar.tsx vendepro-frontend/src/app/\(dashboard\)/landings/\[id\]/page.tsx
git commit -m "feat(landings): editor shell with 3-panes layout and toolbar"
```

---

## Task 7: BlockListSidebar (left pane)

**Files:**
- Create: `vendepro-frontend/src/components/landings/BlockListSidebar.tsx`

- [ ] **Step 1: Left pane with dnd + add/remove/toggle**

Create `vendepro-frontend/src/components/landings/BlockListSidebar.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Eye, EyeOff, Trash2, ChevronDown } from 'lucide-react'
import type { Block, BlockType } from '@/lib/landings/types'
import { BLOCK_LABELS } from './blocks'

const AVAILABLE_BLOCK_TYPES: Array<{ type: BlockType; label: string; seedData: any }> = [
  { type: 'hero-split', label: 'Hero dividido', seedData: { title: 'Título', media_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200', media_side: 'right', accent_color: 'pink' } },
  { type: 'features-grid', label: 'Grid de features', seedData: { columns: 3, items: [{ icon: 'Star', title: 'Feature 1', text: 'Descripción' }, { icon: 'Star', title: 'Feature 2', text: 'Descripción' }, { icon: 'Star', title: 'Feature 3', text: 'Descripción' }] } },
  { type: 'amenities-chips', label: 'Amenities', seedData: { chips: [{ emoji: '✨', label: 'Amenity 1' }, { emoji: '✨', label: 'Amenity 2' }, { emoji: '✨', label: 'Amenity 3' }] } },
  { type: 'gallery', label: 'Galería', seedData: { layout: 'grid', images: [{ url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', source: 'external' }] } },
  { type: 'benefits-list', label: 'Beneficios', seedData: { items: [{ title: 'Beneficio 1' }, { title: 'Beneficio 2' }] } },
]

interface Props {
  blocks: Block[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (ordered: Block[]) => void
  onRemove: (id: string) => Promise<void>
  onToggleVisibility: (id: string, visible: boolean) => void
  onAdd: (block: Omit<Block, 'id'>) => Promise<void>
}

export default function BlockListSidebar({ blocks, selectedId, onSelect, onReorder, onRemove, onToggleVisibility, onAdd }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    onReorder(arrayMove(blocks, oldIndex, newIndex))
  }

  return (
    <aside className="bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500">Bloques ({blocks.length})</h2>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map(b => (
              <SortableBlockRow key={b.id} block={b}
                selected={selectedId === b.id}
                onSelect={() => onSelect(b.id)}
                onRemove={() => onRemove(b.id)}
                onToggleVisibility={() => onToggleVisibility(b.id, !b.visible)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button onClick={() => setShowAdd(v => !v)}
          className="w-full text-sm text-gray-500 hover:text-[#ff007c] border border-dashed border-gray-300 rounded-lg py-2 mt-2 flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Agregar bloque
        </button>

        {showAdd && (
          <div className="border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-1">
            {AVAILABLE_BLOCK_TYPES.map(t => (
              <button key={t.type} onClick={async () => {
                await onAdd({ type: t.type, visible: true, data: t.seedData })
                setShowAdd(false)
              }} className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-white">{t.label}</button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function SortableBlockRow({ block, selected, onSelect, onRemove, onToggleVisibility }: {
  block: Block; selected: boolean; onSelect: () => void; onRemove: () => void; onToggleVisibility: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const isRequired = block.type === 'lead-form'

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm cursor-pointer ${selected ? 'bg-[#ff007c]/10 ring-1 ring-[#ff007c]/40' : 'hover:bg-gray-100'}`}
      onClick={onSelect}>
      <button {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing" aria-label="Reordenar" onClick={e => e.stopPropagation()}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className={`flex-1 truncate ${block.visible ? 'text-gray-800' : 'text-gray-400'}`}>{BLOCK_LABELS[block.type]}</span>
      {isRequired && <span className="text-[10px] text-[#ff007c]" title="Requerido">◆</span>}
      <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700" title={block.visible ? 'Ocultar' : 'Mostrar'}>
        {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      {!isRequired && (
        <button onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar este bloque?')) onRemove() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600" title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/BlockListSidebar.tsx
git commit -m "feat(landings): left sidebar with drag-reorder, visibility toggle, add/remove"
```

---

## Task 8: InspectorPanel (right tab 1)

**Files:**
- Create: `vendepro-frontend/src/components/landings/InspectorPanel.tsx`

- [ ] **Step 1: Inspector con forms por block type**

Create `vendepro-frontend/src/components/landings/InspectorPanel.tsx`:

```tsx
'use client'
import type { Block, HeroData, HeroSplitData, LeadFormData, FeaturesGridData, AmenitiesChipsData, GalleryData, BenefitsListData, FooterData } from '@/lib/landings/types'
import { BLOCK_LABELS } from './blocks'
import ImageUpload from './ImageUpload'

interface Props {
  block: Block
  onChange: (patch: any) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c]" />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c] min-h-[60px] resize-y" />
}

export default function InspectorPanel({ block, onChange }: Props) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-[#ff007c]">Block · {block.type}</p>
        <p className="text-sm text-gray-900 font-medium">{BLOCK_LABELS[block.type]}</p>
      </div>

      {block.type === 'hero' && <HeroFields data={block.data as HeroData} onChange={onChange} />}
      {block.type === 'hero-split' && <HeroSplitFields data={block.data as HeroSplitData} onChange={onChange} />}
      {block.type === 'features-grid' && <FeaturesFields data={block.data as FeaturesGridData} onChange={onChange} />}
      {block.type === 'amenities-chips' && <AmenitiesFields data={block.data as AmenitiesChipsData} onChange={onChange} />}
      {block.type === 'gallery' && <GalleryFields data={block.data as GalleryData} onChange={onChange} />}
      {block.type === 'benefits-list' && <BenefitsFields data={block.data as BenefitsListData} onChange={onChange} />}
      {block.type === 'lead-form' && <LeadFormFields data={block.data as LeadFormData} onChange={onChange} />}
      {block.type === 'footer' && <FooterFields data={block.data as FooterData} onChange={onChange} />}
    </div>
  )
}

function HeroFields({ data, onChange }: { data: HeroData; onChange: (p: Partial<HeroData>) => void }) {
  return (
    <>
      <Field label="Eyebrow (opcional)"><TextInput value={data.eyebrow ?? ''} onChange={e => onChange({ eyebrow: e.target.value })} /></Field>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Imagen de fondo">
        <ImageUpload value={data.background_image_url} onChange={(url) => onChange({ background_image_url: url })} />
      </Field>
      <Field label="Overlay opacity (0 a 1)"><TextInput type="number" min={0} max={1} step={0.1} value={data.overlay_opacity} onChange={e => onChange({ overlay_opacity: parseFloat(e.target.value) })} /></Field>
      <Field label="CTA Label"><TextInput value={data.cta?.label ?? ''} onChange={e => onChange({ cta: { ...(data.cta ?? { href: '#form' }), label: e.target.value } })} /></Field>
      <Field label="CTA href"><TextInput value={data.cta?.href ?? ''} onChange={e => onChange({ cta: { ...(data.cta ?? { label: 'Acción' }), href: e.target.value } })} /></Field>
    </>
  )
}

function HeroSplitFields({ data, onChange }: { data: HeroSplitData; onChange: (p: Partial<HeroSplitData>) => void }) {
  return (
    <>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Imagen"><ImageUpload value={data.media_url} onChange={(url) => onChange({ media_url: url })} /></Field>
      <Field label="Lado de la imagen">
        <select value={data.media_side} onChange={e => onChange({ media_side: e.target.value as any })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="left">Izquierda</option>
          <option value="right">Derecha</option>
        </select>
      </Field>
      <Field label="Acento">
        <select value={data.accent_color} onChange={e => onChange({ accent_color: e.target.value as any })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="pink">Rosa</option>
          <option value="orange">Naranja</option>
          <option value="dark">Oscuro</option>
        </select>
      </Field>
    </>
  )
}

function FeaturesFields({ data, onChange }: { data: FeaturesGridData; onChange: (p: Partial<FeaturesGridData>) => void }) {
  const updateItem = (idx: number, patch: Partial<FeaturesGridData['items'][0]>) => {
    const items = data.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    onChange({ items })
  }
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Columnas">
        <select value={data.columns} onChange={e => onChange({ columns: Number(e.target.value) as 3 | 4 })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value={3}>3</option><option value={4}>4</option>
        </select>
      </Field>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <TextInput placeholder="Ícono (nombre de lucide, ej: Star)" value={it.icon} onChange={e => updateItem(i, { icon: e.target.value })} />
            <TextInput placeholder="Título" value={it.title} onChange={e => updateItem(i, { title: e.target.value })} />
            <TextArea placeholder="Texto" value={it.text} onChange={e => updateItem(i, { text: e.target.value })} />
          </div>
        ))}
      </div>
    </>
  )
}

function AmenitiesFields({ data, onChange }: { data: AmenitiesChipsData; onChange: (p: Partial<AmenitiesChipsData>) => void }) {
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <div className="space-y-2">
        {data.chips.map((c, i) => (
          <div key={i} className="flex gap-2">
            <TextInput className="!w-16" value={c.emoji ?? ''} placeholder="🏊" onChange={e => { const chips = [...data.chips]; chips[i] = { ...c, emoji: e.target.value }; onChange({ chips }) }} />
            <TextInput value={c.label} onChange={e => { const chips = [...data.chips]; chips[i] = { ...c, label: e.target.value }; onChange({ chips }) }} />
          </div>
        ))}
      </div>
    </>
  )
}

function GalleryFields({ data, onChange }: { data: GalleryData; onChange: (p: Partial<GalleryData>) => void }) {
  return (
    <>
      <Field label="Layout">
        <select value={data.layout} onChange={e => onChange({ layout: e.target.value as any })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="grid">Grid</option>
          <option value="mosaic">Mosaico</option>
          <option value="carousel">Carrusel</option>
        </select>
      </Field>
      <Field label="Imágenes">
        <div className="space-y-2">
          {data.images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <img src={img.url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <button onClick={() => onChange({ images: data.images.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">Quitar</button>
            </div>
          ))}
          <ImageUpload value="" allowPropertyPicker onChange={(url, source, property_id) => onChange({ images: [...data.images, { url, source: source ?? 'upload', property_id }] })} />
        </div>
      </Field>
    </>
  )
}

function BenefitsFields({ data, onChange }: { data: BenefitsListData; onChange: (p: Partial<BenefitsListData>) => void }) {
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <TextInput placeholder="Título del beneficio" value={it.title} onChange={e => { const items = [...data.items]; items[i] = { ...it, title: e.target.value }; onChange({ items }) }} />
            <TextArea placeholder="Descripción" value={it.description ?? ''} onChange={e => { const items = [...data.items]; items[i] = { ...it, description: e.target.value }; onChange({ items }) }} />
          </div>
        ))}
      </div>
    </>
  )
}

function LeadFormFields({ data, onChange }: { data: LeadFormData; onChange: (p: Partial<LeadFormData>) => void }) {
  return (
    <>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Label del botón"><TextInput value={data.submit_label} onChange={e => onChange({ submit_label: e.target.value })} /></Field>
      <Field label="Mensaje de éxito"><TextArea value={data.success_message} onChange={e => onChange({ success_message: e.target.value })} /></Field>
      <Field label="Nota de privacidad"><TextArea value={data.privacy_note ?? ''} onChange={e => onChange({ privacy_note: e.target.value })} /></Field>
      <p className="text-xs text-gray-500">Los campos `name` y `phone` son obligatorios y no se pueden quitar.</p>
    </>
  )
}

function FooterFields({ data, onChange }: { data: FooterData; onChange: (p: Partial<FooterData>) => void }) {
  return (
    <>
      <Field label="Nombre inmobiliaria"><TextInput value={data.agency_name ?? ''} onChange={e => onChange({ agency_name: e.target.value })} /></Field>
      <Field label="Matrícula"><TextInput value={data.agency_registration ?? ''} onChange={e => onChange({ agency_registration: e.target.value })} /></Field>
      <Field label="Teléfono"><TextInput value={data.phone ?? ''} onChange={e => onChange({ phone: e.target.value })} /></Field>
      <Field label="Email"><TextInput type="email" value={data.email ?? ''} onChange={e => onChange({ email: e.target.value })} /></Field>
      <Field label="WhatsApp"><TextInput value={data.whatsapp ?? ''} onChange={e => onChange({ whatsapp: e.target.value })} /></Field>
      <Field label="Instagram"><TextInput value={data.instagram ?? ''} onChange={e => onChange({ instagram: e.target.value })} /></Field>
      <Field label="Disclaimer"><TextArea value={data.disclaimer ?? ''} onChange={e => onChange({ disclaimer: e.target.value })} /></Field>
    </>
  )
}
```

- [ ] **Step 2: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/InspectorPanel.tsx
git commit -m "feat(landings): InspectorPanel with per-block type forms"
```

---

## Task 9: AIChatPanel (right tab 2)

**Files:**
- Create: `vendepro-frontend/src/components/landings/AIChatPanel.tsx`

- [ ] **Step 1: Chat IA con scope toggle y accept/reject**

Create `vendepro-frontend/src/components/landings/AIChatPanel.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Send, Sparkles, Check, X, Loader2 } from 'lucide-react'
import { aiApi, landingsApi } from '@/lib/landings/api'

type Scope = 'block' | 'global'

interface Msg {
  role: 'user' | 'ai'
  text: string
  proposal?: { kind: 'block'; blockId: string; data: any } | { kind: 'global'; blocks: any[] }
}

interface Props {
  landingId: string
  selectedBlockId: string | null
  onProposalAccepted: () => Promise<void>
}

export default function AIChatPanel({ landingId, selectedBlockId, onProposalAccepted }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [scope, setScope] = useState<Scope>('block')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    if (scope === 'block' && !selectedBlockId) {
      setMessages(m => [...m, { role: 'ai', text: 'Seleccioná un bloque primero para editarlo con IA.' }])
      return
    }
    const prompt = input.trim().slice(0, 500)
    setInput('')
    setMessages(m => [...m, { role: 'user', text: prompt }])
    setLoading(true)
    try {
      const r = await aiApi.editBlock(landingId, { prompt, scope, blockId: scope === 'block' ? selectedBlockId! : undefined })
      if (r.status === 'error') {
        setMessages(m => [...m, { role: 'ai', text: friendlyError(r.reason) }])
      } else {
        const explanation = r.proposal.kind === 'block' ? 'Listo — propuesta para el bloque seleccionado.' : 'Listo — propuesta global.'
        setMessages(m => [...m, { role: 'ai', text: explanation, proposal: r.proposal as any }])
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'ai', text: 'Error de red: ' + (e.message ?? 'desconocido') }])
    } finally {
      setLoading(false)
    }
  }

  async function accept(msg: Msg, idx: number) {
    if (!msg.proposal) return
    if (msg.proposal.kind === 'block') {
      // Reconstruir el blocks completo con el data nuevo del bloque target
      const { landing } = await landingsApi.get(landingId)
      const blocks = landing.blocks.map(b => b.id === msg.proposal!.blockId ? { ...b, data: msg.proposal!.data } : b)
      await landingsApi.updateBlocks(landingId, blocks, 'manual-save')
    } else {
      await landingsApi.updateBlocks(landingId, msg.proposal.blocks, 'manual-save')
    }
    setMessages(m => m.map((x, i) => i === idx ? { ...x, proposal: undefined, text: x.text + ' ✓ Aplicada.' } : x))
    await onProposalAccepted()
  }

  function reject(idx: number) {
    setMessages(m => m.map((x, i) => i === idx ? { ...x, proposal: undefined, text: x.text + ' (rechazada)' } : x))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs uppercase tracking-wider font-semibold text-[#ff007c] flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Chat IA — Groq
        </p>
        <div className="flex gap-1.5">
          <button onClick={() => setScope('block')}
            className={`text-xs px-2.5 py-1 rounded-md ${scope === 'block' ? 'bg-[#ff007c]/10 text-[#ff007c] border border-[#ff007c]/40' : 'bg-gray-100 text-gray-600 border border-transparent'}`}>
            🎯 Solo bloque
          </button>
          <button onClick={() => setScope('global')}
            className={`text-xs px-2.5 py-1 rounded-md ${scope === 'global' ? 'bg-[#ff007c]/10 text-[#ff007c] border border-[#ff007c]/40' : 'bg-gray-100 text-gray-600 border border-transparent'}`}>
            🌐 Toda la landing
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Escribí un pedido y la IA propone cambios (con Aceptar/Rechazar).</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-[#ff007c]/10 ml-8 text-gray-900' : 'bg-gray-50 mr-8 text-gray-700'}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{msg.role === 'user' ? 'Vos' : 'Groq · llama-3.3-70b'}</p>
            <p>{msg.text}</p>
            {msg.proposal && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => accept(msg, i)} className="inline-flex items-center gap-1 bg-[#ff007c] hover:bg-[#e60070] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Aceptar
                </button>
                <button onClick={() => reject(i)} className="inline-flex items-center gap-1 border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full hover:bg-gray-50">
                  <X className="w-3 h-3" /> Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generando…</div>}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pedile un cambio…" maxLength={500}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c]" />
        <button onClick={send} disabled={loading || !input.trim()} className="bg-[#ff007c] hover:bg-[#e60070] disabled:opacity-50 text-white rounded-lg px-3">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function friendlyError(reason: string): string {
  if (reason === 'schema_mismatch') return 'No pude generar una versión válida. Probá reformular el pedido.'
  if (reason === 'provider_error') return 'La IA está temporalmente saturada. Reintentá en un momento.'
  if (reason === 'timeout') return 'La IA tardó demasiado. Intentá con un pedido más chico.'
  return `Error: ${reason}`
}
```

- [ ] **Step 2: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/AIChatPanel.tsx
git commit -m "feat(landings): AIChatPanel with Groq edit + propose/accept/reject UX"
```

---

## Task 10: Versions drawer + Config drawer + Publish banner + Preview

**Files:**
- Create: `vendepro-frontend/src/components/landings/VersionsDrawer.tsx`
- Create: `vendepro-frontend/src/components/landings/ConfigDrawer.tsx`
- Create: `vendepro-frontend/src/components/landings/PublishReviewBanner.tsx`
- Create: `vendepro-frontend/src/app/(dashboard)/landings/[id]/preview/page.tsx`

- [ ] **Step 1: VersionsDrawer**

Create `vendepro-frontend/src/components/landings/VersionsDrawer.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { X, Clock, Sparkles, Save, CheckCircle2, RotateCcw } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { LandingVersion } from '@/lib/landings/types'

const LABEL_ICON: Record<LandingVersion['label'], any> = {
  'auto-save': Clock, 'manual-save': Save, 'ai-edit': Sparkles, 'publish': CheckCircle2,
}

export default function VersionsDrawer({ landingId, onClose, onRollback }: { landingId: string; onClose: () => void; onRollback: () => Promise<void> }) {
  const [versions, setVersions] = useState<LandingVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    landingsApi.listVersions(landingId).then(r => { setVersions(r.versions); setLoading(false) })
  }, [landingId])

  async function rollback(id: string) {
    if (!confirm('¿Restaurar esta versión? Se crea una nueva versión con este contenido.')) return
    setBusy(id)
    try { await landingsApi.rollback(landingId, id); await onRollback(); onClose() }
    finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-[380px] bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Historial de versiones</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {loading ? <p className="text-sm text-gray-500 text-center mt-8">Cargando…</p> :
            versions.length === 0 ? <p className="text-sm text-gray-500 text-center mt-8">Sin versiones todavía.</p> :
              versions.map(v => {
                const Icon = LABEL_ICON[v.label]
                return (
                  <div key={v.id} className="border border-gray-200 rounded-lg p-3 flex items-start gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-gray-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">v{v.version_number} · {v.label}</p>
                      <p className="text-xs text-gray-500">{new Date(v.created_at).toLocaleString('es-AR')}</p>
                    </div>
                    <button onClick={() => rollback(v.id)} disabled={busy === v.id} className="text-xs text-[#ff007c] hover:underline flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restaurar
                    </button>
                  </div>
                )
              })
          }
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: ConfigDrawer**

Create `vendepro-frontend/src/components/landings/ConfigDrawer.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import { slugifyBase, isValidSlugBase } from '@/lib/landings/slug'
import type { Landing } from '@/lib/landings/types'

export default function ConfigDrawer({ landing, onClose, onSaved }: { landing: Landing; onClose: () => void; onSaved: () => Promise<void> }) {
  const [slugBase, setSlugBase] = useState(landing.slug_base)
  const [brandVoice, setBrandVoice] = useState(landing.brand_voice ?? '')
  const [seoTitle, setSeoTitle] = useState(landing.seo_title ?? '')
  const [seoDesc, setSeoDesc] = useState(landing.seo_description ?? '')
  const [ogImage, setOgImage] = useState(landing.og_image_url ?? '')
  const [leadRulesJson, setLeadRulesJson] = useState(JSON.stringify(landing.lead_rules ?? {}, null, 2))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const normSlug = slugifyBase(slugBase)
    if (!isValidSlugBase(normSlug)) { setError('Slug inválido'); return }
    let leadRules
    try { leadRules = leadRulesJson.trim() ? JSON.parse(leadRulesJson) : null }
    catch { setError('Lead rules JSON inválido'); return }

    setSaving(true); setError(null)
    try {
      await landingsApi.updateMetadata(landing.id, {
        slug_base: normSlug !== landing.slug_base ? normSlug : undefined as any,
        brand_voice: brandVoice || null,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        og_image_url: ogImage || null,
        lead_rules: leadRules,
      })
      await onSaved(); onClose()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside className="absolute right-0 top-0 h-full w-[460px] bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Configuración</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Slug</label>
            <input value={slugBase} onChange={e => setSlugBase(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <p className="text-xs text-gray-500 mt-1">URL: <code>{slugifyBase(slugBase)}-{landing.slug_suffix}.landings.vendepro.com.ar</code></p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Brand voice (para la IA)</label>
            <textarea value={brandVoice} onChange={e => setBrandVoice(e.target.value)} maxLength={300} placeholder="ej: cálido, cercano, profesional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y min-h-[80px]" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">SEO Title</label>
            <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} maxLength={60} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">SEO Description</label>
            <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} maxLength={160} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">OG Image URL</label>
            <input value={ogImage} onChange={e => setOgImage(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Lead rules (JSON)</label>
            <textarea value={leadRulesJson} onChange={e => setLeadRulesJson(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y min-h-[120px]" />
            <p className="text-xs text-gray-500 mt-1">Ej: <code>{'{"assigned_agent_id":"u_123","tags":["palermo"],"campaign":"Q2","notify_channels":["email"]}'}</code></p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t border-gray-200">
          <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold py-2.5 rounded-full disabled:opacity-60">
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: PublishReviewBanner**

Create `vendepro-frontend/src/components/landings/PublishReviewBanner.tsx`:

```tsx
import { XCircle } from 'lucide-react'

export default function PublishReviewBanner({ note }: { note: string }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-900">Publicación rechazada</p>
        <p className="text-sm text-amber-800">{note}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Preview page (para drafts)**

Create `vendepro-frontend/src/app/(dashboard)/landings/[id]/preview/page.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { landingsApi } from '@/lib/landings/api'
import type { Landing } from '@/lib/landings/types'
import BlockRenderer from '@/components/landings/BlockRenderer'

export default function LandingPreviewPage() {
  const params = useParams<{ id: string }>()
  const [landing, setLanding] = useState<Landing | null>(null)
  useEffect(() => { landingsApi.get(params.id).then(r => setLanding(r.landing)) }, [params.id])
  if (!landing) return <div className="p-12 text-center text-gray-500">Cargando preview…</div>

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-amber-50 text-amber-900 text-center text-xs py-2 border-b border-amber-200">
        Vista previa interna · status: <strong>{landing.status}</strong>
      </div>
      <BlockRenderer blocks={landing.blocks} mode="public" />
    </div>
  )
}
```

- [ ] **Step 5: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/VersionsDrawer.tsx vendepro-frontend/src/components/landings/ConfigDrawer.tsx vendepro-frontend/src/components/landings/PublishReviewBanner.tsx vendepro-frontend/src/app/\(dashboard\)/landings/\[id\]/preview/
git commit -m "feat(landings): versions drawer, config drawer, review banner, preview page"
```

---

## Task 11: ImageUpload + PropertyPhotoPicker

**Files:**
- Create: `vendepro-frontend/src/components/landings/ImageUpload.tsx`
- Create: `vendepro-frontend/src/components/landings/PropertyPhotoPicker.tsx`

- [ ] **Step 1: ImageUpload con 3 modos (upload R2, URL externa, propiedad CRM)**

Create `vendepro-frontend/src/components/landings/ImageUpload.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Upload, Link as LinkIcon, Home } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import PropertyPhotoPicker from './PropertyPhotoPicker'

interface Props {
  value: string
  onChange: (url: string, source?: 'upload' | 'external' | 'property', property_id?: string) => void
  allowPropertyPicker?: boolean
}

export default function ImageUpload({ value, onChange, allowPropertyPicker }: Props) {
  const [mode, setMode] = useState<'upload' | 'url' | 'property'>('upload')
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState(value || '')
  const [showPicker, setShowPicker] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('prefix', 'landings')
      // Nota: api-admin ya expone un endpoint de upload a R2 (verificar ruta exacta en backend). Usamos 'admin' API.
      const res = await apiFetch('admin', '/uploads', { method: 'POST', body: form } as any)
      if (!res.ok) throw new Error('Upload falló')
      const { url } = (await res.json()) as any
      onChange(url, 'upload')
    } catch (e: any) {
      alert('Error subiendo imagen: ' + e.message)
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-2">
      {value && <img src={value} alt="" className="w-full h-28 rounded-lg object-cover" />}

      <div className="flex gap-1">
        <button onClick={() => setMode('upload')} className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'upload' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Upload className="w-3.5 h-3.5 inline mr-1" /> Subir
        </button>
        <button onClick={() => setMode('url')} className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'url' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
          <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> URL
        </button>
        {allowPropertyPicker && (
          <button onClick={() => setMode('property')} className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'property' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Home className="w-3.5 h-3.5 inline mr-1" /> Propiedad
          </button>
        )}
      </div>

      {mode === 'upload' && (
        <label className="block">
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          <span className="block text-center text-xs py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#ff007c]">
            {uploading ? 'Subiendo…' : 'Seleccionar archivo'}
          </span>
        </label>
      )}

      {mode === 'url' && (
        <div className="flex gap-1">
          <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://…"
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
          <button onClick={() => onChange(urlInput, 'external')} className="bg-gray-900 text-white text-xs px-3 rounded-lg">Usar</button>
        </div>
      )}

      {mode === 'property' && allowPropertyPicker && (
        <>
          <button onClick={() => setShowPicker(true)} className="w-full text-xs py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#ff007c]">
            Elegir desde una propiedad del CRM
          </button>
          {showPicker && (
            <PropertyPhotoPicker
              onPick={(url, property_id) => { onChange(url, 'property', property_id); setShowPicker(false) }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
```

**Nota:** el endpoint `POST /uploads` en `api-admin` es asumido. Si no existe, revisar ingeniería de uploads del proyecto; si no hay, agregarlo como Task aparte o usar la ruta que ya tiene `properties` (property photos).

- [ ] **Step 2: PropertyPhotoPicker**

Create `vendepro-frontend/src/components/landings/PropertyPhotoPicker.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PropertyLite { id: string; title: string; address: string }
interface Photo { url: string }

export default function PropertyPhotoPicker({ onPick, onClose }: { onPick: (url: string, propertyId: string) => void; onClose: () => void }) {
  const [properties, setProperties] = useState<PropertyLite[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])

  useEffect(() => {
    apiFetch('properties', '/properties').then(r => r.json()).then((data: any) => setProperties(data.properties ?? []))
  }, [])

  useEffect(() => {
    if (!selectedId) { setPhotos([]); return }
    apiFetch('properties', `/properties/${selectedId}/photos`).then(r => r.json()).then((data: any) => setPhotos(data.photos ?? []))
  }, [selectedId])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex" onClick={e => e.stopPropagation()}>
        <aside className="w-60 border-r border-gray-200 overflow-auto">
          <div className="p-3 border-b border-gray-200"><h3 className="text-sm font-semibold">Propiedades</h3></div>
          {properties.map(p => (
            <button key={p.id} onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-3 py-2 text-sm ${selectedId === p.id ? 'bg-[#ff007c]/10 text-[#ff007c]' : 'hover:bg-gray-50'}`}>
              <p className="font-medium truncate">{p.title}</p>
              <p className="text-xs text-gray-500 truncate">{p.address}</p>
            </button>
          ))}
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold">Fotos</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-auto p-3 grid grid-cols-3 gap-2">
            {photos.map((ph, i) => (
              <button key={i} onClick={() => onPick(ph.url, selectedId!)} className="aspect-square bg-cover bg-center rounded-lg ring-1 ring-gray-200 hover:ring-[#ff007c]"
                style={{ backgroundImage: `url(${ph.url})` }} aria-label={`Foto ${i + 1}`} />
            ))}
            {selectedId && photos.length === 0 && <p className="col-span-3 text-sm text-gray-500 text-center mt-8">Esta propiedad no tiene fotos.</p>}
            {!selectedId && <p className="col-span-3 text-sm text-gray-500 text-center mt-8">Elegí una propiedad a la izquierda.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/ImageUpload.tsx vendepro-frontend/src/components/landings/PropertyPhotoPicker.tsx
git commit -m "feat(landings): ImageUpload (R2/URL/CRM) + PropertyPhotoPicker"
```

---

## Task 12: Build + smoke manual + cleanup

**Files:**
- No hay creaciones nuevas. Validación global.

- [ ] **Step 1: Typecheck global**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 2: Build**

Run: `cd vendepro-frontend && npm run build`
Expected: build OK.

- [ ] **Step 3: Smoke manual con `npm run dev`**

Levantar dev server. Login con un user admin. Smoke path:
1. Ir a `/landings` → listado vacío o con templates existentes.
2. Click "Nueva landing" → wizard → elegir template → nombrar → redirige al editor.
3. Editor: seleccionar hero → cambiar título en inspector → auto-save dispara a los 30s (o click manual "Guardar").
4. Tab "Chat IA" → prompt "hacelo más formal" con scope "Solo bloque" → recibir propuesta → Aceptar.
5. Abrir VersionsDrawer → ver varias versiones → click Restaurar en una → la landing se revierte.
6. Abrir ConfigDrawer → cambiar slug_base → guardar → el full_slug se actualiza.
7. Agente: "Solicitar publicación" → status = pending_review.
8. (Con user admin en otra pestaña) `/landings` tab Pendientes → abrir → "Aprobar y publicar" → status = published.
9. Preview interno: `/landings/:id/preview` → muestra la landing.
10. Archivar / Desarchivar.

Documentar cualquier bug en issues antes de mergear.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore(landings): Fase B editor — smoke validation"
```

---

## Self-review

**Spec coverage:**
- [x] 8 block components + BlockRenderer con mode public/editor (Tasks 2, 3)
- [x] Listado /landings con tabs (Task 4)
- [x] Wizard creación (Task 5)
- [x] Editor 3-panes con toolbar (Task 6)
- [x] Left sidebar con drag/visibilidad/add/remove (Task 7)
- [x] Inspector por block type (Task 8)
- [x] AI Chat con scope + propose/accept/reject (Task 9)
- [x] Versions drawer con rollback (Task 10)
- [x] Config drawer con slug/SEO/brand_voice/lead_rules (Task 10)
- [x] Publish review banner (Task 10)
- [x] Preview interna para drafts (Task 10)
- [x] ImageUpload R2/URL/propiedad CRM (Task 11)
- [x] Property photo picker (Task 11)
- [x] Approval flow admin (EditorToolbar)
- [x] Auto-save + manual save + dirty indicator

**Placeholder scan:** el Task 11 asume endpoint `/uploads` en `api-admin`. Si no existe, hay un ítem explícito en el texto para agregarlo. No hay TODOs en el plan.

**Scope:** Fase B entrega el editor funcional. Lo público (subdomain routing, form submit real con UTM, analytics tracking JS, dashboard de analytics) vive en Fase C.

---

## Siguiente

Al completar Fase B, ejecutar **Fase C** (`2026-04-18-landings-fase-c-public.md`): middleware subdomain, `app/l/[slug]/page.tsx` server component, form submit con UTMs, analytics tracking JS y tablero de métricas.
