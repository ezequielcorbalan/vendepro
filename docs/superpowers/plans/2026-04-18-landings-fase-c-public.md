# Landings con IA — Plan Fase C (Público + Analytics)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer las landings publicadas accesibles en `<slug>.landings.vendepro.com.ar`, capturar leads desde el formulario con UTMs, trackear eventos de visitante (pageview, cta_click, form_start, form_submit) y mostrar un tablero de analytics en el detalle admin.

**Architecture:** Next.js 15 middleware detecta el host con subdomain y hace `rewrite` a `/l/[slug]`. El Server Component fetchea `api-public` con ISR 60s y genera metadata dinámica para SEO. Un componente cliente captura UTMs de query, guarda cookie `visitor_id`, y dispara eventos vía `POST /l/:slug/event`. El dashboard de analytics consume `GET /landings/:id/analytics` desde el editor.

**Tech Stack:** Next.js 15 middleware, Server Components + ISR, Recharts para charts, cookie first-party SHA-256 para visitor_id.

**Spec de referencia:** `docs/superpowers/specs/2026-04-18-landings-design.md`

**Dependencias:**
- Fase A deployada (rutas `api-public` y `api-crm` responden).
- Fase B mergeada (para reusar los block components + `BlockRenderer`).
- Infra CF configurada (wildcard DNS + Pages custom domain) — va como Task 6 de este plan, manual en dashboard.

**Árbol de archivos afectados:**

```
vendepro-frontend/
  src/
    middleware.ts                                    (MOD — detectar subdomain + rewrite)
    app/
      l/
        [slug]/
          page.tsx                                   (NEW — Server Component público)
          loading.tsx                                (NEW)
          not-found.tsx                              (NEW)
    lib/
      landings/
        public-api.ts                                (NEW — api-public wrappers para submit/event)
        tracker.ts                                   (NEW — lógica de visitor_id, UTM, dispatch de events)
    components/
      landings/
        public/
          PublicForm.tsx                             (NEW — wrapper de LeadFormBlock con submit real)
          Tracker.tsx                                (NEW — client component que dispara pageview + cta_click + form_start)
        analytics/
          AnalyticsDashboard.tsx                     (NEW — KPI cards + funnel + chart + UTMs)
    app/
      (dashboard)/
        landings/
          [id]/
            page.tsx                                 (MOD — sumar tab o drawer de Analytics al editor)
docs/
  superpowers/
    runbooks/
      2026-04-18-landings-dns-setup.md               (NEW — pasos manuales CF)
```

---

## Task 1: middleware.ts — subdomain rewrite

**Files:**
- Modify: `vendepro-frontend/src/middleware.ts`

- [ ] **Step 1: Leer middleware actual y agregar lógica antes de la lógica de auth**

Editar `vendepro-frontend/src/middleware.ts`. El archivo actual tiene `isPublic`, `PUBLIC_PREFIXES`, y la función `middleware`. Agregar al tope:

```typescript
const LANDING_HOST_RE = /^([a-z0-9][a-z0-9-]{1,60}[a-z0-9])\.landings\.vendepro\.com\.ar$/i
```

Agregar `/l/` a `PUBLIC_PREFIXES`:

```typescript
const PUBLIC_PREFIXES = [
  '/r/', '/t/', '/v/', '/p/',
  '/l/',          // landings públicas
  '/_next', '/favicon', '/logo', '/api/',
]
```

- [ ] **Step 2: Insertar subdomain detection al tope del middleware**

Al inicio de la función `middleware(request)`, antes de cualquier otra lógica:

```typescript
export function middleware(request: NextRequest) {
  // === Landing subdomain rewrite ===
  const host = request.headers.get('host')?.toLowerCase() ?? ''
  const landingMatch = host.match(LANDING_HOST_RE)
  if (landingMatch) {
    const slug = landingMatch[1]
    const url = request.nextUrl.clone()
    // Evitar doble rewrite si ya estamos en /l/:slug (caso edge)
    if (!url.pathname.startsWith('/l/')) {
      url.pathname = `/l/${slug}`
    }
    return NextResponse.rewrite(url)
  }

  const { pathname } = request.nextUrl
  // ... resto de la lógica existente (auth check, etc.) ...
}
```

- [ ] **Step 3: Build + typecheck**

Run: `cd vendepro-frontend && npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add vendepro-frontend/src/middleware.ts
git commit -m "feat(frontend): middleware rewrite de *.landings.vendepro.com.ar a /l/:slug"
```

---

## Task 2: Public API client + tracker

**Files:**
- Create: `vendepro-frontend/src/lib/landings/public-api.ts`
- Create: `vendepro-frontend/src/lib/landings/tracker.ts`

- [ ] **Step 1: public-api.ts — wrappers sin auth**

Create `vendepro-frontend/src/lib/landings/public-api.ts`:

```typescript
// API client para landings públicas. NO usa apiFetch (que inyecta auth) — va raw contra api-public.

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

export interface PublicLandingView {
  id: string
  full_slug: string
  kind: 'lead_capture' | 'property'
  blocks: any[]     // Block[] — reusa types/types.ts si importás
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_at: string
}

export async function getPublicLanding(slug: string): Promise<PublicLandingView | null> {
  const res = await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}`, { next: { revalidate: 60 } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`api-public ${res.status}`)
  const { landing } = (await res.json()) as any
  return landing
}

export interface SubmitInput {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  message?: string | null
  visitorId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}

export async function submitLandingForm(slug: string, input: SubmitInput): Promise<{ leadId: string; successMessage: string }> {
  const res = await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`submit ${res.status}: ${await res.text()}`)
  return (await res.json()) as any
}

export async function recordLandingEvent(slug: string, event: {
  type: 'pageview' | 'cta_click' | 'form_start' | 'form_submit'
  visitorId?: string | null
  sessionId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null }
}) {
  await fetch(`${PUBLIC_BASE}/l/${encodeURIComponent(slug)}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,            // permite que salga en beforeunload
  }).catch(() => { /* silent */ })
}
```

- [ ] **Step 2: tracker.ts — visitor_id + session_id + UTM helpers**

Create `vendepro-frontend/src/lib/landings/tracker.ts`:

```typescript
// Tracker client-only. No tocar en SSR.

const VISITOR_COOKIE = 'vendepro_lvid'
const SESSION_STORAGE_KEY = 'vendepro_lsid'
const VISITOR_TTL_DAYS = 30

function uuid(): string {
  return crypto.randomUUID()
}

export function getOrCreateVisitorId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = readCookie(VISITOR_COOKIE)
  if (existing) return existing
  const id = uuid()
  setCookie(VISITOR_COOKIE, id, VISITOR_TTL_DAYS)
  return id
}

export function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing
  const id = uuid()
  sessionStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

export function readUtmFromUrl(): { source?: string | null; medium?: string | null; campaign?: string | null; referrer?: string | null } {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  return {
    source: q.get('utm_source'),
    medium: q.get('utm_medium'),
    campaign: q.get('utm_campaign'),
    referrer: document.referrer || null,
  }
}

function readCookie(name: string): string | null {
  const parts = document.cookie.split('; ')
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k === name) return decodeURIComponent(v ?? '')
  }
  return null
}

function setCookie(name: string, value: string, days: number): void {
  const exp = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax; Secure`
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd vendepro-frontend && npx tsc --noEmit`

```bash
git add vendepro-frontend/src/lib/landings/public-api.ts vendepro-frontend/src/lib/landings/tracker.ts
git commit -m "feat(frontend): public API client + tracker (visitor_id, session, UTM)"
```

---

## Task 3: Página pública `/l/[slug]` (Server Component + SEO)

**Files:**
- Create: `vendepro-frontend/src/app/l/[slug]/page.tsx`
- Create: `vendepro-frontend/src/app/l/[slug]/loading.tsx`
- Create: `vendepro-frontend/src/app/l/[slug]/not-found.tsx`

- [ ] **Step 1: Server Component con generateMetadata**

Create `vendepro-frontend/src/app/l/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlockRenderer from '@/components/landings/BlockRenderer'
import PublicForm from '@/components/landings/public/PublicForm'
import Tracker from '@/components/landings/public/Tracker'
import { getPublicLanding } from '@/lib/landings/public-api'
import type { Block } from '@/lib/landings/types'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const landing = await getPublicLanding(slug).catch(() => null)
  if (!landing) return { title: 'No disponible' }
  return {
    title: landing.seo_title ?? slug,
    description: landing.seo_description ?? undefined,
    openGraph: {
      title: landing.seo_title ?? slug,
      description: landing.seo_description ?? undefined,
      images: landing.og_image_url ? [landing.og_image_url] : undefined,
    },
    robots: 'index, follow',
  }
}

export const revalidate = 60

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params
  const landing = await getPublicLanding(slug)
  if (!landing) notFound()

  // Separamos el lead-form del array para pasarle el onSubmit client; el resto se renderiza tal cual.
  const leadFormBlock = landing.blocks.find(b => b.type === 'lead-form')
  const otherBlocks = landing.blocks.filter(b => b.type !== 'lead-form') as Block[]
  const allInOrder = landing.blocks as Block[]

  return (
    <main className="min-h-screen bg-white text-gray-900 font-[Poppins]">
      <Tracker slug={slug} />
      {/* Render principal: todos los bloques tal cual excepto el lead-form */}
      <div className="[&_[data-lead-form]]:hidden">
        <BlockRenderer blocks={allInOrder} mode="public" />
      </div>
      {/* Render del form con handler real — ubicado según posición en el array */}
      {leadFormBlock && <PublicForm slug={slug} data={leadFormBlock.data as any} />}
    </main>
  )
}
```

**Nota sobre la composición del form:** la estrategia anterior inserta el lead-form via componente separado al final para poder pasarle el `onSubmit`. Alternativa: que el BlockRenderer propague `onFormSubmit` (que ya está en el tipo). Preferimos la versión simple: renderizar todos los bloques con BlockRenderer + propagar el handler:

Simplificamos el page a:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import BlockRenderer from '@/components/landings/BlockRenderer'
import Tracker from '@/components/landings/public/Tracker'
import { getPublicLanding } from '@/lib/landings/public-api'
import PublicForm from '@/components/landings/public/PublicForm'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const landing = await getPublicLanding(slug).catch(() => null)
  if (!landing) return { title: 'No disponible' }
  return {
    title: landing.seo_title ?? slug,
    description: landing.seo_description ?? undefined,
    openGraph: {
      title: landing.seo_title ?? slug,
      description: landing.seo_description ?? undefined,
      images: landing.og_image_url ? [landing.og_image_url] : undefined,
    },
    robots: 'index, follow',
  }
}

export const revalidate = 60

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params
  const landing = await getPublicLanding(slug)
  if (!landing) notFound()

  return (
    <main className="min-h-screen bg-white text-gray-900 font-[Poppins]">
      <Tracker slug={slug} />
      <PublicForm.Provider slug={slug}>
        {/* Provider inyecta onFormSubmit al BlockRenderer */}
        <BlockRendererWithSubmit blocks={landing.blocks as any} />
      </PublicForm.Provider>
    </main>
  )
}
```

**Para mantenerlo simple sin provider**: el archivo final es así:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PublicLandingShell from '@/components/landings/public/PublicLandingShell'
import { getPublicLanding } from '@/lib/landings/public-api'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const landing = await getPublicLanding(slug).catch(() => null)
  if (!landing) return { title: 'No disponible' }
  return {
    title: landing.seo_title ?? slug,
    description: landing.seo_description ?? undefined,
    openGraph: {
      title: landing.seo_title ?? slug,
      description: landing.seo_description ?? undefined,
      images: landing.og_image_url ? [landing.og_image_url] : undefined,
    },
    robots: 'index, follow',
  }
}

export const revalidate = 60

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params
  const landing = await getPublicLanding(slug)
  if (!landing) notFound()
  return <PublicLandingShell slug={slug} blocks={landing.blocks as any} />
}
```

- [ ] **Step 2: Loading y not-found**

Create `vendepro-frontend/src/app/l/[slug]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
      Cargando…
    </div>
  )
}
```

Create `vendepro-frontend/src/app/l/[slug]/not-found.tsx`:

```tsx
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Landing no encontrada</h1>
      <p className="text-gray-600">La página que buscás no existe o no está publicada.</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit placeholder (la shell se implementa en Task 4)**

```bash
git add vendepro-frontend/src/app/l/
git commit -m "feat(frontend): public landing page shell + SEO metadata"
```

---

## Task 4: PublicLandingShell + Tracker + PublicForm

**Files:**
- Create: `vendepro-frontend/src/components/landings/public/PublicLandingShell.tsx`
- Create: `vendepro-frontend/src/components/landings/public/Tracker.tsx`
- Create: `vendepro-frontend/src/components/landings/public/PublicForm.tsx`

- [ ] **Step 1: Shell — client component que arma todo**

Create `vendepro-frontend/src/components/landings/public/PublicLandingShell.tsx`:

```tsx
'use client'
import { useCallback } from 'react'
import BlockRenderer from '@/components/landings/BlockRenderer'
import Tracker from './Tracker'
import type { Block } from '@/lib/landings/types'
import { submitLandingForm, recordLandingEvent } from '@/lib/landings/public-api'
import { getOrCreateVisitorId, getOrCreateSessionId, readUtmFromUrl } from '@/lib/landings/tracker'

export default function PublicLandingShell({ slug, blocks }: { slug: string; blocks: Block[] }) {
  const onFormSubmit = useCallback(async (values: Record<string, string>) => {
    const visitorId = getOrCreateVisitorId()
    const utm = readUtmFromUrl()
    await submitLandingForm(slug, {
      name: values.name ?? '',
      phone: values.phone ?? '',
      email: values.email ?? null,
      address: values.address ?? null,
      message: values.message ?? null,
      visitorId,
      utm,
    })
    // También dispara event form_submit (el backend ya lo hace internamente desde el submit, pero por si hay interés de tracking separado)
    recordLandingEvent(slug, { type: 'form_submit', visitorId, sessionId: getOrCreateSessionId(), utm }).catch(() => {})
  }, [slug])

  return (
    <>
      <Tracker slug={slug} />
      <BlockRenderer blocks={blocks} mode="public" onFormSubmit={onFormSubmit} />
    </>
  )
}
```

- [ ] **Step 2: Tracker — pageview + cta_click + form_start**

Create `vendepro-frontend/src/components/landings/public/Tracker.tsx`:

```tsx
'use client'
import { useEffect } from 'react'
import { recordLandingEvent } from '@/lib/landings/public-api'
import { getOrCreateVisitorId, getOrCreateSessionId, readUtmFromUrl } from '@/lib/landings/tracker'

export default function Tracker({ slug }: { slug: string }) {
  useEffect(() => {
    const visitorId = getOrCreateVisitorId()
    const sessionId = getOrCreateSessionId()
    const utm = readUtmFromUrl()

    recordLandingEvent(slug, { type: 'pageview', visitorId, sessionId, utm })

    // CTA click: todos los <a> dentro de la landing con href="#form" o data-cta
    function onClickCta(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a, button') as HTMLElement | null
      if (!target) return
      const href = target.getAttribute('href')
      const isCta = href === '#form' || target.dataset.cta === 'true'
      if (isCta) {
        recordLandingEvent(slug, { type: 'cta_click', visitorId, sessionId, utm }).catch(() => {})
      }
    }

    // Form start: primer focus en un input dentro de #form
    function onFormFocus(e: FocusEvent) {
      const t = e.target as HTMLElement
      const form = t.closest('#form') || t.closest('form')
      if (form) {
        recordLandingEvent(slug, { type: 'form_start', visitorId, sessionId, utm }).catch(() => {})
        document.removeEventListener('focusin', onFormFocus, true)
      }
    }

    document.addEventListener('click', onClickCta, true)
    document.addEventListener('focusin', onFormFocus, true)
    return () => {
      document.removeEventListener('click', onClickCta, true)
      document.removeEventListener('focusin', onFormFocus, true)
    }
  }, [slug])

  return null
}
```

- [ ] **Step 3: PublicForm (no-op — el submit va via BlockRenderer + shell)**

Opcional — si queremos exponer un Provider pattern para encapsular el submit dentro del LeadFormBlock.

**En realidad no hace falta** un archivo separado `PublicForm.tsx` porque el handler ya viaja por `onFormSubmit` prop al BlockRenderer → LeadFormBlock. Si el plan original lo listaba, lo omitimos.

- [ ] **Step 4: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/public/
git commit -m "feat(landings): PublicLandingShell + Tracker (pageview/cta_click/form_start)"
```

---

## Task 5: Analytics dashboard en el editor

**Files:**
- Create: `vendepro-frontend/src/components/landings/analytics/AnalyticsDashboard.tsx`
- Modify: `vendepro-frontend/src/app/(dashboard)/landings/[id]/page.tsx` (agregar botón + drawer)

- [ ] **Step 1: Dashboard component**

Create `vendepro-frontend/src/components/landings/analytics/AnalyticsDashboard.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { landingsApi } from '@/lib/landings/api'
import type { AnalyticsSummary } from '@/lib/landings/types'

function KPI({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function FunnelRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_70px] items-center py-2 border-b border-gray-100 last:border-b-0 text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mx-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="text-right text-gray-900 font-medium">{count.toLocaleString('es-AR')}</span>
    </div>
  )
}

export default function AnalyticsDashboard({ landingId }: { landingId: string }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [range, setRange] = useState<7 | 14 | 30>(7)

  useEffect(() => {
    setData(null)
    landingsApi.analytics(landingId, range).then(r => setData(r.summary)).catch(() => setData(null))
  }, [landingId, range])

  if (!data) return <div className="p-8 text-center text-gray-500">Cargando métricas…</div>

  const pct = (n: number) => data.pageviews > 0 ? (n / data.pageviews) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([7, 14, 30] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`text-xs px-3 py-1.5 rounded-full ${range === r ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-700'}`}>
            Últimos {r} días
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pageviews" value={data.pageviews.toLocaleString('es-AR')} />
        <KPI label="Unique visitors" value={data.unique_visitors.toLocaleString('es-AR')} />
        <KPI label="Form submits" value={data.form_submits.toLocaleString('es-AR')} />
        <KPI label="Conversion rate" value={`${(data.conversion_rate * 100).toFixed(1)}%`} hint="submits / pageviews" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Pageviews por día</h4>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={data.pageviews_by_day}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ff007c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Funnel</h4>
          <FunnelRow label="Pageviews" count={data.pageviews} pct={100} />
          <FunnelRow label="CTA clicks" count={data.cta_clicks} pct={pct(data.cta_clicks)} />
          <FunnelRow label="Form start" count={data.form_starts} pct={pct(data.form_starts)} />
          <FunnelRow label="Submit" count={data.form_submits} pct={pct(data.form_submits)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Top UTM sources</h4>
        <div className="space-y-1.5">
          {data.top_utm_sources.length === 0 && <p className="text-sm text-gray-500">Sin datos.</p>}
          {data.top_utm_sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{s.source}</span>
              <span className="text-gray-900 font-medium">{s.count.toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar en el editor — agregar botón en toolbar + drawer**

Modify `vendepro-frontend/src/components/landings/EditorToolbar.tsx` — agregar un botón entre Config y Vista previa:

```tsx
import { BarChart3 } from 'lucide-react'
// ...
interface Props {
  // ...existing...
  onOpenAnalytics: () => void
}
// En el return, antes del botón "Vista previa":
<button onClick={onOpenAnalytics} className="p-2 hover:bg-gray-100 rounded-lg" title="Analytics"><BarChart3 className="w-4 h-4 text-gray-600" /></button>
```

Modify `vendepro-frontend/src/app/(dashboard)/landings/[id]/page.tsx`:

Agregar state `const [showAnalytics, setShowAnalytics] = useState(false)` y pasarle `onOpenAnalytics={() => setShowAnalytics(true)}` al `EditorToolbar`. Renderizar al final:

```tsx
import AnalyticsDashboard from '@/components/landings/analytics/AnalyticsDashboard'
// ...
{showAnalytics && (
  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowAnalytics(false)}>
    <aside className="absolute right-0 top-0 h-full w-[520px] bg-gray-50 shadow-xl overflow-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h2 className="font-semibold text-gray-900">Analytics</h2>
        <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4">
        <AnalyticsDashboard landingId={landing.id} />
      </div>
    </aside>
  </div>
)}
```

(Importar `X` si no está ya.)

- [ ] **Step 3: Build + commit**

```bash
git add vendepro-frontend/src/components/landings/analytics/ vendepro-frontend/src/components/landings/EditorToolbar.tsx vendepro-frontend/src/app/\(dashboard\)/landings/\[id\]/page.tsx
git commit -m "feat(landings): analytics dashboard (KPIs + funnel + chart + UTM) en editor"
```

---

## Task 6: Infra — wildcard DNS + Pages custom domain

**Files:**
- Create: `docs/superpowers/runbooks/2026-04-18-landings-dns-setup.md`

**Este task no es código.** Es un checklist de pasos manuales en el dashboard de Cloudflare. Lo ejecuta un humano con acceso a CF.

- [ ] **Step 1: Crear runbook**

Create `docs/superpowers/runbooks/2026-04-18-landings-dns-setup.md`:

```markdown
# Landings — DNS + Pages custom domain

## Objetivo
Habilitar `*.landings.vendepro.com.ar` para que las landings publicadas sean accesibles.

## Pre-requisitos
- Acceso a Cloudflare Dashboard de la cuenta VendéPro.
- `vendepro-frontend` ya deployado en Pages.

## Pasos

### 1. DNS wildcard
1. Dashboard → Websites → `vendepro.com.ar` → DNS → Records.
2. Add record:
   - Type: **CNAME**
   - Name: `*.landings`
   - Target: `vendepro-frontend.pages.dev` (o el hostname actual del proyecto Pages — confirmar en Workers & Pages → vendepro-frontend)
   - Proxy status: **Proxied** 🟧
   - TTL: Auto
3. Save.

### 2. Pages custom domain
1. Dashboard → Workers & Pages → `vendepro-frontend` → Custom domains.
2. Set up a custom domain → `*.landings.vendepro.com.ar` → Continue.
3. Esperar el cert SSL automático (puede tardar 1-5 min).
4. Status debe quedar: **Active**.

### 3. Verificar

```bash
# Desde terminal local (no es deploy, solo curl):
curl -I https://anything.landings.vendepro.com.ar/
# Esperado: 404 (porque el slug no existe) — pero responde el middleware → significa que el subdomain llega a Pages.

# Con una landing publicada:
curl https://<full_slug>.landings.vendepro.com.ar/
# Esperado: HTML con la landing renderizada.
```

### 4. CORS en api-public
Si el worker `api-public` ya fue deployado con el cambio de CORS (Fase A, Task 25, Step 5), los submits deberían funcionar. Verificar con un submit de prueba:

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "Origin: https://test.landings.vendepro.com.ar" \
  -d '{"name":"Smoke","phone":"111"}' \
  https://public.api.vendepro.com.ar/l/<full_slug>/submit
```

Debe responder 201 con `{ leadId, successMessage }`.

## Rollback
Si hay problemas:
1. Borrar el registro CNAME `*.landings` del DNS.
2. Remover el custom domain de Pages.
Las landings dejan de ser accesibles pero el CRM sigue funcionando normalmente.

## Notas
- CF emite cert wildcard automático al agregar el custom domain. No hace falta Advanced Certificate Manager (esa opción es paga y solo hace falta para dominios custom del cliente — fase 2).
- Si Pages no permite wildcard en el plan actual, alternativa: rebondear a un Worker dedicado con `routes` patrón `*.landings.vendepro.com.ar/*` que internamente proxea a Pages. Documentar si hay que ir por ese camino.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-04-18-landings-dns-setup.md
git commit -m "docs(runbook): landings DNS + Pages custom domain manual setup"
```

---

## Task 7: E2E manual smoke

**Files:**
- No crea archivos.

- [ ] **Step 1: Ejecutar runbook de DNS (Task 6) en CF dashboard**

Humano: seguir pasos 1-4 del runbook.

- [ ] **Step 2: Publicar una landing real**

Desde `/landings`: crear una landing desde template, editarla con IA, solicitar publicación, (admin) aprobar y publicar.

- [ ] **Step 3: Verificar en browser**

1. Abrir `https://<full_slug>.landings.vendepro.com.ar`.
2. Verificar render visual: hero, bloques intermedios, lead-form.
3. Abrir DevTools Network:
   - Al cargar → `POST /l/:slug/event` con `type=pageview`.
   - Al clickear el CTA del hero → `POST /l/:slug/event` con `type=cta_click`.
   - Al focusear el primer input del form → `POST /l/:slug/event` con `type=form_start`.
4. Submit del form:
   - `POST /l/:slug/submit` → 201.
   - Ver success message inline.
5. En CRM `/leads` → aparece el nuevo lead con `source=landing:<slug>` y tags si aplicó.

- [ ] **Step 4: Verificar analytics en el editor**

1. Volver al editor de la landing publicada.
2. Click en el botón de analytics (gráfico en toolbar).
3. Ver KPIs, funnel, chart de 7 días y top UTM sources.
4. Si visitaste con `?utm_source=test`, ver `test` en el top.

- [ ] **Step 5: Commit (cambios dev.vars, si hubo)**

Si durante el smoke hubo ajustes a `.env.example` o `package.json`:

```bash
git add <archivos afectados>
git commit -m "chore(landings): Fase C smoke validation"
```

---

## Self-review

**Spec coverage:**
- [x] middleware rewrite `*.landings.vendepro.com.ar` → `/l/:slug` (Task 1)
- [x] Server Component `/l/[slug]/page.tsx` con SEO dinámico (Task 3)
- [x] ISR 60s + cache CF s-maxage=300 (revalidate en fetch + header en api-public de Fase A)
- [x] PublicLandingShell conecta onFormSubmit real (Task 4)
- [x] Tracker: pageview, cta_click, form_start (Task 4)
- [x] Form submit con UTM + visitor_id (Task 4)
- [x] Dashboard de analytics embebido en editor (Task 5)
- [x] Infra runbook documentado (Task 6)
- [x] E2E manual smoke (Task 7)

**Placeholder scan:**
- Task 3: hay iteración de soluciones hasta llegar a la final (PublicLandingShell). El step final queda explícito.
- Task 5 requiere modificar archivos que ya existen (EditorToolbar + editor page). Los cambios están explícitos.

**Consistency:**
- `getPublicLanding`, `submitLandingForm`, `recordLandingEvent` son consistentes entre public-api.ts, PublicLandingShell y Tracker.
- `visitor_id` cookie name = `vendepro_lvid`, `session` = `vendepro_lsid` en sessionStorage. Coherente entre tracker.ts y el uso.
- Los endpoints consumidos (`GET /l/:slug`, `POST /l/:slug/submit`, `POST /l/:slug/event`, `GET /landings/:id/analytics`) están todos definidos en Fase A.

---

## Cierre del feature

Al completar Fases A + B + C, el feature de landings queda entregado end-to-end:
- Agentes crean landings desde templates, editan con IA.
- Admin aprueba y publica.
- Subdominio wildcard sirve las landings.
- Leads entran al CRM con UTMs trackeados.
- Agente/admin ve analytics básicos.

**Fuera de scope (fase 2+):**
- Dominios custom del cliente
- Cache purge automático en publish
- A/B testing
- Turnstile captcha
- Schedule-publish
- Roll-up diario de eventos
- Bloques adicionales (testimonials, stats, map, faq)
- IA que cambia imágenes
- Multi-idioma
- Export HTML estático
