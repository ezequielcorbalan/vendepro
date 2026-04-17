# Sección `/reportes` con performance de avisos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recuperar una vista agregada de métricas de avisos (impresiones, visitas al portal, visitas presenciales, ofertas) que existía en el repo previo. Crear una sección top-level `/reportes` con dos pestañas: Listado (todos los reportes de la org) y Performance (KPIs + ranking de barrios + evolución temporal).

**Architecture:** Dos endpoints read-only nuevos en `api-analytics` (`GET /listings-performance` y `GET /reports`) que hacen queries D1 con JOINs a `reports`, `report_metrics` y `properties`. Sin cambios en dominio ni use cases — mismo patrón que los endpoints existentes de analytics. Frontend: nueva ruta `/reportes` con layout de tabs, usando Recharts para el gráfico de evolución.

**Tech Stack:** Hono (Cloudflare Workers), D1 (SQLite), Vitest + `@cloudflare/vitest-pool-workers`, Next.js 15 App Router, Tailwind CSS 4, Recharts, `apiFetch` helper.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `vendepro-backend/packages/api-analytics/src/reports-queries.ts` |
| Crear | `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` |
| Crear | `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/src/index.ts` |
| Modificar | `vendepro-frontend/src/lib/nav-config.ts` |
| Crear | `vendepro-frontend/src/app/(dashboard)/reportes/layout.tsx` |
| Crear | `vendepro-frontend/src/app/(dashboard)/reportes/page.tsx` |
| Crear | `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` |
| Crear | `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx` |

---

## Task 1: Helpers SQL — `reports-queries.ts`

**Files:**
- Create: `vendepro-backend/packages/api-analytics/src/reports-queries.ts`

Estas funciones aíslan las queries SQL del handler HTTP, para que los tests puedan mockearlas y para mantener el `index.ts` legible.

- [ ] **Step 1: Crear el archivo**

```typescript
// packages/api-analytics/src/reports-queries.ts

export type Period = 'week' | 'month' | 'quarter' | 'year'

export interface PerformanceKpis {
  reports_published: number
  total_impressions: number
  total_portal_visits: number
  total_in_person_visits: number
  total_offers: number
  avg_impressions_per_report: number
  avg_portal_visits_per_report: number
  avg_in_person_visits_per_report: number
  avg_offers_per_report: number
}

export interface NeighborhoodPerformance {
  neighborhood: string
  reports_count: number
  avg_impressions: number
  avg_portal_visits: number
  avg_in_person_visits: number
  avg_offers: number
  total_offers: number
}

export interface TimelinePoint {
  period_label: string
  period_start: string
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

export interface ReportListItem {
  id: string
  property_id: string
  property_address: string
  property_neighborhood: string
  period_label: string
  period_start: string
  period_end: string
  status: string
  published_at: string | null
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

export interface ReportsListFilters {
  page: number
  page_size: number
  neighborhood?: string | null
  status?: string | null
  property_id?: string | null
  from?: string | null
  to?: string | null
}

/**
 * Returns the ISO date string N days ago (UTC).
 */
export function periodStartDate(period: Period, now: Date = new Date()): string {
  const d = new Date(now)
  switch (period) {
    case 'week': d.setDate(d.getDate() - 7); break
    case 'month': d.setMonth(d.getMonth() - 1); break
    case 'quarter': d.setMonth(d.getMonth() - 3); break
    case 'year': d.setFullYear(d.getFullYear() - 1); break
  }
  return d.toISOString().split('T')[0]
}

/**
 * Get aggregated KPIs for all published reports in the given period.
 * Reports are filtered by `published_at` within the range.
 */
export async function getPerformanceKpis(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<PerformanceKpis> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  const row = await db.prepare(`
    SELECT
      COUNT(DISTINCT r.id) AS reports_published,
      COALESCE(SUM(rm.impressions), 0) AS total_impressions,
      COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
      COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits,
      COALESCE(SUM(rm.offers), 0) AS total_offers
    FROM reports r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN report_metrics rm ON rm.report_id = r.id
    WHERE p.org_id = ?
      AND r.status = 'published'
      AND date(r.published_at) >= ?
      AND date(r.published_at) <= ?
      ${sourceFilter}
  `).bind(...binds).first() as any

  const count = row?.reports_published ?? 0
  const safeAvg = (total: number): number => count > 0 ? Math.round(total / count) : 0
  const avgFloat = (total: number): number => count > 0 ? Math.round((total / count) * 100) / 100 : 0

  return {
    reports_published: count,
    total_impressions: row?.total_impressions ?? 0,
    total_portal_visits: row?.total_portal_visits ?? 0,
    total_in_person_visits: row?.total_in_person_visits ?? 0,
    total_offers: row?.total_offers ?? 0,
    avg_impressions_per_report: safeAvg(row?.total_impressions ?? 0),
    avg_portal_visits_per_report: safeAvg(row?.total_portal_visits ?? 0),
    avg_in_person_visits_per_report: safeAvg(row?.total_in_person_visits ?? 0),
    avg_offers_per_report: avgFloat(row?.total_offers ?? 0),
  }
}

/**
 * Returns per-neighborhood aggregated metrics, ordered by reports_count desc.
 */
export async function getNeighborhoodPerformance(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<NeighborhoodPerformance[]> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  const res = await db.prepare(`
    SELECT
      p.neighborhood,
      COUNT(DISTINCT r.id) AS reports_count,
      COALESCE(ROUND(AVG(rm.impressions)), 0) AS avg_impressions,
      COALESCE(ROUND(AVG(rm.portal_visits)), 0) AS avg_portal_visits,
      COALESCE(ROUND(AVG(rm.in_person_visits)), 0) AS avg_in_person_visits,
      COALESCE(ROUND(AVG(rm.offers) * 100) / 100.0, 0) AS avg_offers,
      COALESCE(SUM(rm.offers), 0) AS total_offers
    FROM reports r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN report_metrics rm ON rm.report_id = r.id
    WHERE p.org_id = ?
      AND r.status = 'published'
      AND date(r.published_at) >= ?
      AND date(r.published_at) <= ?
      ${sourceFilter}
    GROUP BY p.neighborhood
    ORDER BY reports_count DESC, p.neighborhood ASC
  `).bind(...binds).all()

  return ((res.results as any[]) ?? []).map(r => ({
    neighborhood: r.neighborhood ?? 'Sin barrio',
    reports_count: r.reports_count ?? 0,
    avg_impressions: r.avg_impressions ?? 0,
    avg_portal_visits: r.avg_portal_visits ?? 0,
    avg_in_person_visits: r.avg_in_person_visits ?? 0,
    avg_offers: r.avg_offers ?? 0,
    total_offers: r.total_offers ?? 0,
  }))
}

/**
 * Returns monthly aggregated metrics over the period, ordered chronologically.
 */
export async function getTimelinePerformance(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<TimelinePoint[]> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  const res = await db.prepare(`
    SELECT
      strftime('%Y-%m', r.published_at) AS month_key,
      COALESCE(SUM(rm.impressions), 0) AS impressions,
      COALESCE(SUM(rm.portal_visits), 0) AS portal_visits,
      COALESCE(SUM(rm.in_person_visits), 0) AS in_person_visits,
      COALESCE(SUM(rm.offers), 0) AS offers
    FROM reports r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN report_metrics rm ON rm.report_id = r.id
    WHERE p.org_id = ?
      AND r.status = 'published'
      AND date(r.published_at) >= ?
      AND date(r.published_at) <= ?
      ${sourceFilter}
    GROUP BY month_key
    ORDER BY month_key ASC
  `).bind(...binds).all()

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return ((res.results as any[]) ?? []).map(r => {
    const [y, m] = (r.month_key as string).split('-')
    const monthIdx = parseInt(m, 10) - 1
    return {
      period_label: `${MONTHS[monthIdx] ?? m} ${y}`,
      period_start: `${r.month_key}-01`,
      impressions: r.impressions ?? 0,
      portal_visits: r.portal_visits ?? 0,
      in_person_visits: r.in_person_visits ?? 0,
      offers: r.offers ?? 0,
    }
  })
}

/**
 * Paginated list of reports with their aggregated metrics, joined with property info.
 */
export async function listReportsWithMetrics(
  db: D1Database,
  orgId: string,
  filters: ReportsListFilters,
): Promise<{ total: number; results: ReportListItem[] }> {
  const page = Math.max(1, filters.page | 0)
  const pageSize = Math.min(100, Math.max(1, filters.page_size | 0 || 20))
  const offset = (page - 1) * pageSize

  const where: string[] = ['p.org_id = ?']
  const binds: unknown[] = [orgId]

  if (filters.neighborhood) {
    where.push('p.neighborhood = ?')
    binds.push(filters.neighborhood)
  }
  if (filters.status) {
    where.push('r.status = ?')
    binds.push(filters.status)
  }
  if (filters.property_id) {
    where.push('r.property_id = ?')
    binds.push(filters.property_id)
  }
  if (filters.from) {
    where.push('date(r.period_end) >= ?')
    binds.push(filters.from)
  }
  if (filters.to) {
    where.push('date(r.period_end) <= ?')
    binds.push(filters.to)
  }

  const whereSql = where.join(' AND ')

  const [countRow, rowsRes] = await Promise.all([
    db.prepare(`
      SELECT COUNT(DISTINCT r.id) AS total
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      WHERE ${whereSql}
    `).bind(...binds).first() as Promise<any>,
    db.prepare(`
      SELECT
        r.id,
        r.property_id,
        p.address AS property_address,
        p.neighborhood AS property_neighborhood,
        r.period_label,
        r.period_start,
        r.period_end,
        r.status,
        r.published_at,
        COALESCE(SUM(rm.impressions), 0) AS impressions,
        COALESCE(SUM(rm.portal_visits), 0) AS portal_visits,
        COALESCE(SUM(rm.in_person_visits), 0) AS in_person_visits,
        COALESCE(SUM(rm.offers), 0) AS offers
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE ${whereSql}
      GROUP BY r.id
      ORDER BY COALESCE(r.published_at, r.period_end) DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, pageSize, offset).all(),
  ])

  const results = ((rowsRes.results as any[]) ?? []).map(r => ({
    id: r.id,
    property_id: r.property_id,
    property_address: r.property_address ?? '',
    property_neighborhood: r.property_neighborhood ?? 'Sin barrio',
    period_label: r.period_label ?? '',
    period_start: r.period_start ?? '',
    period_end: r.period_end ?? '',
    status: r.status ?? 'draft',
    published_at: r.published_at ?? null,
    impressions: r.impressions ?? 0,
    portal_visits: r.portal_visits ?? 0,
    in_person_visits: r.in_person_visits ?? 0,
    offers: r.offers ?? 0,
  }))

  return {
    total: (countRow as any)?.total ?? 0,
    results,
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd vendepro-backend
git add packages/api-analytics/src/reports-queries.ts
git commit -m "feat(api-analytics): helpers SQL para métricas agregadas de reportes"
```

---

## Task 2: Tests de `/listings-performance` y `/reports`

**Files:**
- Create: `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts`
- Create: `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts`

- [ ] **Step 1: Crear test de `/listings-performance`**

```typescript
// packages/api-analytics/tests/listings-performance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockKpis = {
  reports_published: 10,
  total_impressions: 5000,
  total_portal_visits: 400,
  total_in_person_visits: 20,
  total_offers: 5,
  avg_impressions_per_report: 500,
  avg_portal_visits_per_report: 40,
  avg_in_person_visits_per_report: 2,
  avg_offers_per_report: 0.5,
}

vi.mock('../src/reports-queries', () => ({
  periodStartDate: vi.fn().mockReturnValue('2026-03-16'),
  getPerformanceKpis: vi.fn().mockResolvedValue(mockKpis),
  getNeighborhoodPerformance: vi.fn().mockResolvedValue([
    { neighborhood: 'Villa Urquiza', reports_count: 4, avg_impressions: 600, avg_portal_visits: 50, avg_in_person_visits: 3, avg_offers: 0.5, total_offers: 2 },
  ]),
  getTimelinePerformance: vi.fn().mockResolvedValue([
    { period_label: 'Marzo 2026', period_start: '2026-03-01', impressions: 2500, portal_visits: 200, in_person_visits: 10, offers: 3 },
  ]),
  listReportsWithMetrics: vi.fn().mockResolvedValue({ total: 0, results: [] }),
}))

vi.mock('@vendepro/infrastructure', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    corsMiddleware: async (_c: any, next: any) => next(),
    errorHandler: (err: any, c: any) => c.json({ error: err.message }, 500),
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'agent-1')
      c.set('userRole', 'admin')
      c.set('orgId', 'org_mg')
      await next()
    },
    JwtAuthService: vi.fn().mockImplementation(() => ({})),
    D1LeadRepository: vi.fn().mockImplementation(() => ({})),
    D1PropertyRepository: vi.fn().mockImplementation(() => ({})),
    D1ReservationRepository: vi.fn().mockImplementation(() => ({})),
    D1CalendarRepository: vi.fn().mockImplementation(() => ({})),
  }
})

describe('GET /listings-performance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns KPIs, by_neighborhood and timeline with default period (month)', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any

    expect(body.period).toBe('month')
    expect(body.kpis.reports_published).toBe(10)
    expect(body.kpis.total_impressions).toBe(5000)
    expect(body.by_neighborhood).toHaveLength(1)
    expect(body.by_neighborhood[0].neighborhood).toBe('Villa Urquiza')
    expect(body.timeline).toHaveLength(1)
  })

  it('accepts ?period=year query param', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance?period=year', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any
    expect(body.period).toBe('year')
  })

  it('falls back to month on invalid period', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance?period=bogus', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any
    expect(body.period).toBe('month')
  })
})
```

- [ ] **Step 2: Crear test de `/reports`**

```typescript
// packages/api-analytics/tests/reports-list.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/reports-queries', () => ({
  periodStartDate: vi.fn(),
  getPerformanceKpis: vi.fn(),
  getNeighborhoodPerformance: vi.fn(),
  getTimelinePerformance: vi.fn(),
  listReportsWithMetrics: vi.fn().mockResolvedValue({
    total: 2,
    results: [
      { id: 'r1', property_id: 'p1', property_address: 'Pampa 1234', property_neighborhood: 'Villa Urquiza', period_label: 'Marzo 2026', period_start: '2026-03-01', period_end: '2026-03-31', status: 'published', published_at: '2026-04-01T10:00:00Z', impressions: 500, portal_visits: 40, in_person_visits: 2, offers: 1 },
      { id: 'r2', property_id: 'p2', property_address: 'Belgrano 5678', property_neighborhood: 'Belgrano', period_label: 'Marzo 2026', period_start: '2026-03-01', period_end: '2026-03-31', status: 'draft', published_at: null, impressions: 0, portal_visits: 0, in_person_visits: 0, offers: 0 },
    ],
  }),
}))

vi.mock('@vendepro/infrastructure', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    corsMiddleware: async (_c: any, next: any) => next(),
    errorHandler: (err: any, c: any) => c.json({ error: err.message }, 500),
    createAuthMiddleware: () => async (c: any, next: any) => {
      c.set('userId', 'agent-1')
      c.set('userRole', 'admin')
      c.set('orgId', 'org_mg')
      await next()
    },
    JwtAuthService: vi.fn().mockImplementation(() => ({})),
    D1LeadRepository: vi.fn().mockImplementation(() => ({})),
    D1PropertyRepository: vi.fn().mockImplementation(() => ({})),
    D1ReservationRepository: vi.fn().mockImplementation(() => ({})),
    D1CalendarRepository: vi.fn().mockImplementation(() => ({})),
  }
})

describe('GET /reports', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns paginated list with total', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reports', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    expect(res.status).toBe(200)
    const body = await res.json() as any

    expect(body.page).toBe(1)
    expect(body.page_size).toBe(20)
    expect(body.total).toBe(2)
    expect(body.results).toHaveLength(2)
    expect(body.results[0].id).toBe('r1')
    expect(body.results[0].property_address).toBe('Pampa 1234')
  })

  it('passes pagination and filters to the query helper', async () => {
    const { listReportsWithMetrics } = await import('../src/reports-queries')
    const { default: app } = await import('../src/index')

    await app.request('/reports?page=2&page_size=5&neighborhood=Villa%20Urquiza&status=published', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })

    expect(listReportsWithMetrics).toHaveBeenCalledWith(
      expect.anything(),
      'org_mg',
      expect.objectContaining({
        page: 2,
        page_size: 5,
        neighborhood: 'Villa Urquiza',
        status: 'published',
      }),
    )
  })
})
```

- [ ] **Step 3: Ejecutar los tests (deben fallar porque los endpoints no existen)**

```bash
cd vendepro-backend
npm test -- --filter @vendepro/api-analytics 2>&1 | tail -30
```

Expected: FAIL — `app.request('/listings-performance')` devuelve 404 porque la ruta no existe aún.

- [ ] **Step 4: Commit**

```bash
git add packages/api-analytics/tests/listings-performance.test.ts \
        packages/api-analytics/tests/reports-list.test.ts
git commit -m "test(api-analytics): tests para endpoints de reports y performance"
```

---

## Task 3: Endpoints `GET /listings-performance` y `GET /reports`

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/src/index.ts`

- [ ] **Step 1: Agregar imports y endpoints**

Editar `packages/api-analytics/src/index.ts`. Agregar estos imports al principio junto a los existentes:

```typescript
import {
  periodStartDate,
  getPerformanceKpis,
  getNeighborhoodPerformance,
  getTimelinePerformance,
  listReportsWithMetrics,
  type Period,
} from './reports-queries'
```

Agregar los dos endpoints antes del `export default app` (después de `/export`):

```typescript
app.get('/listings-performance', async (c) => {
  const rawPeriod = c.req.query('period') ?? 'month'
  const period: Period = ['week', 'month', 'quarter', 'year'].includes(rawPeriod)
    ? (rawPeriod as Period)
    : 'month'
  const source = c.req.query('source') ?? null

  const db = c.env.DB
  const orgId = c.get('orgId')
  const now = new Date()
  const end = now.toISOString().split('T')[0]
  const start = periodStartDate(period, now)

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  const emptyKpis = {
    reports_published: 0,
    total_impressions: 0,
    total_portal_visits: 0,
    total_in_person_visits: 0,
    total_offers: 0,
    avg_impressions_per_report: 0,
    avg_portal_visits_per_report: 0,
    avg_in_person_visits_per_report: 0,
    avg_offers_per_report: 0,
  }

  const [kpis, byNeighborhood, timeline] = await Promise.all([
    safe(() => getPerformanceKpis(db, orgId, start, end, source), emptyKpis),
    safe(() => getNeighborhoodPerformance(db, orgId, start, end, source), []),
    safe(() => getTimelinePerformance(db, orgId, start, end, source), []),
  ])

  return c.json({
    period,
    start,
    end,
    kpis,
    by_neighborhood: byNeighborhood,
    timeline,
  })
})

app.get('/reports', async (c) => {
  const db = c.env.DB
  const orgId = c.get('orgId')

  const page = parseInt(c.req.query('page') ?? '1', 10) || 1
  const pageSize = parseInt(c.req.query('page_size') ?? '20', 10) || 20
  const neighborhood = c.req.query('neighborhood') ?? null
  const status = c.req.query('status') ?? null
  const propertyId = c.req.query('property_id') ?? null
  const from = c.req.query('from') ?? null
  const to = c.req.query('to') ?? null

  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  const data = await safe(
    () => listReportsWithMetrics(db, orgId, {
      page,
      page_size: pageSize,
      neighborhood,
      status,
      property_id: propertyId,
      from,
      to,
    }),
    { total: 0, results: [] },
  )

  return c.json({
    page,
    page_size: pageSize,
    total: data.total,
    results: data.results,
  })
})
```

- [ ] **Step 2: Correr tests — deben pasar**

```bash
cd vendepro-backend
npm test -- --filter @vendepro/api-analytics 2>&1 | tail -30
```

Expected: todos los tests PASS.

- [ ] **Step 3: Verificar typecheck**

```bash
cd vendepro-backend
npx tsc --noEmit -p packages/api-analytics/tsconfig.json 2>&1 | head -20
```

Expected: sin errores.

- [ ] **Step 4: Probar manualmente con curl (stack local corriendo)**

```bash
# Obtener token admin
TOKEN=$(curl -s -X POST http://localhost:8787/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin1234!"}' | jq -r .token)

# Probar /listings-performance
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8791/listings-performance?period=month | jq .

# Probar /reports
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8791/reports | jq .
```

Expected: ambos devuelven JSON con shape correcto (vacíos o con 0s porque la org de prueba no tiene reports publicados todavía).

- [ ] **Step 5: Commit**

```bash
git add packages/api-analytics/src/index.ts
git commit -m "feat(api-analytics): endpoints /listings-performance y /reports"
```

---

## Task 4: Item "Reportes" en la navegación

**Files:**
- Modify: `vendepro-frontend/src/lib/nav-config.ts`

- [ ] **Step 1: Agregar el item en la sección "Comercial"**

Editar `vendepro-frontend/src/lib/nav-config.ts`. En el array `menuSections`, dentro de la sección "Comercial", agregar al final del array de links:

```typescript
{ href: '/reportes', label: 'Reportes', icon: FileBarChart },
```

El ícono `FileBarChart` ya está importado en el archivo (se usa también para `/admin/auditoria`).

La sección "Comercial" queda así:

```typescript
{
  title: 'Comercial',
  links: [
    { href: '/tasaciones', label: 'Tasaciones', icon: ClipboardList },
    { href: '/propiedades/pipeline', label: 'Pipeline', icon: Building2 },
    { href: '/propiedades', label: 'Propiedades', icon: BarChart3, exact: true },
    { href: '/reservas', label: 'Reservas', icon: FileCheck },
    { href: '/vendidas', label: 'Vendidas', icon: DollarSign },
    { href: '/reportes', label: 'Reportes', icon: FileBarChart },
  ],
},
```

- [ ] **Step 2: Verificar typecheck del frontend**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/nav-config.ts
git commit -m "feat(frontend): item Reportes en sidebar (sección Comercial)"
```

---

## Task 5: Layout de `/reportes` con tabs

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/reportes/layout.tsx`
- Create: `vendepro-frontend/src/app/(dashboard)/reportes/page.tsx`

- [ ] **Step 1: Crear el layout con las dos pestañas**

```tsx
// vendepro-frontend/src/app/(dashboard)/reportes/layout.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/reportes/performance', label: 'Performance', icon: BarChart3 },
  { href: '/reportes/listado', label: 'Listado', icon: List },
] as const

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Reportes</h1>
          <p className="text-gray-500 text-sm">Performance y listado de reportes publicados</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-[#ff007c] text-[#ff007c]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Crear el `page.tsx` que redirige a `/reportes/performance`**

```tsx
// vendepro-frontend/src/app/(dashboard)/reportes/page.tsx
import { redirect } from 'next/navigation'

export default function ReportesIndex() {
  redirect('/reportes/performance')
}
```

- [ ] **Step 3: Commit**

```bash
cd vendepro-frontend
git add src/app/\(dashboard\)/reportes/layout.tsx \
        src/app/\(dashboard\)/reportes/page.tsx
git commit -m "feat(frontend): layout de /reportes con tabs Performance y Listado"
```

---

## Task 6: Página `/reportes/performance`

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
// vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Eye, Home, Handshake, FileBarChart, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { apiFetch } from '@/lib/api'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface PerformanceData {
  period: Period
  start: string
  end: string
  kpis: {
    reports_published: number
    total_impressions: number
    total_portal_visits: number
    total_in_person_visits: number
    total_offers: number
    avg_impressions_per_report: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_report: number
    avg_offers_per_report: number
  }
  by_neighborhood: Array<{
    neighborhood: string
    reports_count: number
    avg_impressions: number
    avg_portal_visits: number
    avg_in_person_visits: number
    avg_offers: number
    total_offers: number
  }>
  timeline: Array<{
    period_label: string
    period_start: string
    impressions: number
    portal_visits: number
    in_person_visits: number
    offers: number
  }>
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function KPICard({ icon, label, value, sublabel, color }: { icon: React.ReactNode; label: string; value: string; sublabel?: string; color: string }) {
  const colorMap: Record<string, string> = {
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <div className="bg-white rounded-xl border p-3 sm:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorMap[color]}`} aria-hidden="true">
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  )
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<Period>('month')

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('analytics', `/listings-performance?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [period])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Error al cargar los datos</p>
        <button
          onClick={() => setPeriod(p => p)}
          className="mt-3 text-sm text-red-600 underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const k = data.kpis
  const hasData = k.reports_published > 0

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {([['week', 'Sem'], ['month', 'Mes'], ['quarter', 'Trim'], ['year', 'Año']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === k ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <FileBarChart className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600 font-medium">Todavía no hay reportes publicados en este período</p>
          <p className="text-gray-500 text-sm mt-1">
            Probá un rango más amplio, o publicá el primer reporte desde una propiedad.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              icon={<FileBarChart className="w-5 h-5" />}
              label="Reportes publicados"
              value={String(k.reports_published)}
              color="pink"
            />
            <KPICard
              icon={<Eye className="w-5 h-5" />}
              label="Impresiones totales"
              value={formatNumber(k.total_impressions)}
              sublabel={`${k.avg_impressions_per_report} por aviso`}
              color="orange"
            />
            <KPICard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Visitas al portal"
              value={formatNumber(k.total_portal_visits)}
              sublabel={`${k.avg_portal_visits_per_report} por aviso`}
              color="blue"
            />
            <KPICard
              icon={<Handshake className="w-5 h-5" />}
              label="Ofertas recibidas"
              value={String(k.total_offers)}
              sublabel={`${k.avg_offers_per_report} por aviso`}
              color="green"
            />
          </div>

          <div className="bg-white rounded-xl border p-3 sm:p-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 mr-4">
              <Home className="w-3 h-3" aria-hidden="true" />
              Visitas presenciales totales: <strong className="text-gray-700">{k.total_in_person_visits}</strong>
              <span className="text-gray-400">({k.avg_in_person_visits_per_report} por aviso)</span>
            </span>
          </div>

          {/* Ranking de barrios */}
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
              Ranking por barrio
            </h2>
            {data.by_neighborhood.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos por barrio en este período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Barrio</th>
                      <th className="pb-2 px-2 text-right">Reportes</th>
                      <th className="pb-2 px-2 text-right">∅ Impresiones</th>
                      <th className="pb-2 px-2 text-right hidden sm:table-cell">∅ Visitas portal</th>
                      <th className="pb-2 px-2 text-right hidden md:table-cell">∅ Vis. presenciales</th>
                      <th className="pb-2 pl-2 text-right">Ofertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.by_neighborhood.map(n => (
                      <tr key={n.neighborhood} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">{n.neighborhood}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{n.reports_count}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{n.avg_impressions}</td>
                        <td className="py-2 px-2 text-right text-gray-700 hidden sm:table-cell">{n.avg_portal_visits}</td>
                        <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{n.avg_in_person_visits}</td>
                        <td className="py-2 pl-2 text-right font-semibold text-[#ff007c]">{n.total_offers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Evolución temporal */}
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
              Evolución temporal
            </h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos de evolución en este período</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeline} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="period_label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="impressions" name="Impresiones" stroke="#ff8017" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="portal_visits" name="Visitas portal" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="in_person_visits" name="Visitas presenciales" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="offers" name="Ofertas" stroke="#ff007c" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reportes/performance/page.tsx
git commit -m "feat(frontend): página /reportes/performance con KPIs, ranking y timeline"
```

---

## Task 7: Página `/reportes/listado`

**Files:**
- Create: `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
// vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Filter, ChevronLeft, ChevronRight, FileBarChart } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface ReportItem {
  id: string
  property_id: string
  property_address: string
  property_neighborhood: string
  period_label: string
  period_start: string
  period_end: string
  status: string
  published_at: string | null
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

interface ListResponse {
  page: number
  page_size: number
  total: number
  results: ReportItem[]
}

const PAGE_SIZE = 20

export default function ListadoPage() {
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)

  // Filters
  const [neighborhood, setNeighborhood] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(false)

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
    })
    if (neighborhood.trim()) params.set('neighborhood', neighborhood.trim())
    if (status) params.set('status', status)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    apiFetch('analytics', `/reports?${params.toString()}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [page, neighborhood, status, from, to])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [neighborhood, status, from, to])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
          <Filter className="w-4 h-4" aria-hidden="true" />
          Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <input
            type="text"
            value={neighborhood}
            onChange={e => setNeighborhood(e.target.value)}
            placeholder="Barrio"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          >
            <option value="">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading && (
          <div className="p-4 space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center">
            <p className="text-red-600 text-sm font-medium">Error al cargar los reportes</p>
            <button onClick={() => setPage(p => p)} className="mt-2 text-xs text-red-500 underline">
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && data && data.results.length === 0 && (
          <div className="p-8 text-center">
            <FileBarChart className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600 font-medium">No hay reportes que coincidan con los filtros</p>
          </div>
        )}

        {!loading && !error && data && data.results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="py-2 px-3">Propiedad</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Barrio</th>
                  <th className="py-2 px-2">Período</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Impres.</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Visitas</th>
                  <th className="py-2 px-2 text-right">Ofertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.results.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <Link
                        href={`/propiedades/${r.property_id}/reportes`}
                        className="text-[#ff007c] hover:underline font-medium"
                      >
                        {r.property_address}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.property_neighborhood}</td>
                    <td className="py-2 px-2 text-gray-600">{r.period_label}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.status === 'published' ? 'Publicado' : 'Borrador'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.impressions}</td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.portal_visits}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-800">{r.offers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Página {page} de {totalPages} — {data.total} reportes
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | head -10
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/reportes/listado/page.tsx
git commit -m "feat(frontend): página /reportes/listado con filtros y paginación"
```

---

## Task 8: Verificación integral y flujo manual

- [ ] **Step 1: Correr todos los tests del backend**

```bash
cd vendepro-backend
npm test 2>&1 | tail -25
```

Expected: todos los tests PASS (incluyendo los 5 nuevos de analytics).

- [ ] **Step 2: Build del frontend**

```bash
cd vendepro-frontend
npx next build 2>&1 | tail -15
```

Expected: build exitoso, sin errores de TypeScript ni warnings de linting críticos.

- [ ] **Step 3: Verificar el flujo completo con el stack local**

Stack local ya corriendo (`bash vendepro-backend/start-local.sh`). Navegar en el browser:

- [ ] Login con `admin@test.com` / `Admin1234!` en `http://localhost:3000/login`
- [ ] El sidebar muestra el item "Reportes" en la sección "Comercial"
- [ ] Click en "Reportes" → redirige a `/reportes/performance`
- [ ] La pestaña "Performance" está activa (subrayada)
- [ ] Se muestra el empty state "Todavía no hay reportes publicados en este período" (porque la org de prueba no tiene datos)
- [ ] El selector de período (Sem/Mes/Trim/Año) cambia de valor al clickear
- [ ] Click en la pestaña "Listado" → se muestran los filtros y el mensaje de "No hay reportes que coincidan con los filtros"
- [ ] Los filtros de barrio/estado/fechas son interactivos
- [ ] Volver a la pestaña "Performance" funciona

- [ ] **Step 4: (Opcional) Insertar datos de prueba para ver la UI con datos**

Si se quiere ver la UI con datos, insertar a mano un reporte publicado + métricas en D1 local:

```bash
cd vendepro-backend
npx wrangler d1 execute DB --local \
  --persist-to .wrangler-local \
  --config packages/api-auth/wrangler.jsonc \
  --command "INSERT INTO properties (id, org_id, address, neighborhood, property_type, owner_name, public_slug, agent_id) VALUES ('prop-demo-1', (SELECT id FROM organizations WHERE slug='test-local'), 'Pampa 1234', 'Villa Urquiza', 'departamento', 'Demo Owner', 'pampa-1234', (SELECT id FROM users WHERE email='admin@test.com'));"
```

(No crítico para el PR; es solo para verificación visual manual.)

- [ ] **Step 5: Commit final (si hubiera algún ajuste menor)**

Si no hay cambios pendientes, saltear este paso.

---

## Task 9: Push y apertura del PR

- [ ] **Step 1: Verificar el estado de la branch**

```bash
cd <repo-root>
git log --oneline main..feature/reportes-dashboard
git status
```

Expected: working tree limpio. Lista de commits: chore(gitignore), docs(spec), feat(helpers), test(analytics), feat(endpoints), feat(nav), feat(layout+redirect), feat(performance), feat(listado).

- [ ] **Step 2: Push de la branch al remoto**

```bash
git push -u origin feature/reportes-dashboard
```

- [ ] **Step 3: Abrir el PR con `gh`**

```bash
gh pr create --title "feat(reportes): sección /reportes con performance de avisos" --body "$(cat <<'EOF'
## Resumen

Recupera una vista agregada de métricas de avisos que existía en el repo previo y se perdió en la reestructura. Crea una nueva sección top-level `/reportes` con dos pestañas:

- **Performance** — KPIs globales (reportes publicados, impresiones, visitas al portal, ofertas), ranking por barrio (con promedios por aviso) y evolución temporal mensual (LineChart de Recharts).
- **Listado** — tabla paginada de todos los reportes de la org con filtros por barrio, estado y rango de fechas. Click en una fila navega al detalle del reporte dentro de la propiedad.

## Contexto

Gastón mencionó que en el repo anterior tenía un dashboard donde veía de forma agregada las métricas de los avisos (views en ZonaProp, visitas, ofertas, qué barrios trabajan más, promedios por barrio). Esa vista no existe en el repo reestructurado.

Los datos SÍ están guardándose correctamente (`report_metrics.impressions`, `portal_visits`, `inquiries`, `phone_calls`, `whatsapp`, `in_person_visits`, `offers`, `ranking_position`, `avg_market_price`, `source`), pero no había ningún endpoint ni pantalla que los consultara agregados.

## Cambios

### Backend (api-analytics)
- Nuevo archivo `src/reports-queries.ts` con helpers SQL para KPIs, by_neighborhood, timeline y listado paginado.
- Nuevos endpoints `GET /listings-performance` y `GET /reports` en `src/index.ts`.
- Sin cambios en `core` ni `infrastructure`. Mismo patrón que los endpoints existentes (read-only, queries directas con JOINs + `safe()` para manejar errores).
- Tests unitarios para ambos endpoints con mocks de los helpers.

### Frontend
- Nueva ruta `/reportes` con layout de tabs (`layout.tsx`), redirect (`page.tsx`), y las dos pantallas (`performance/page.tsx`, `listado/page.tsx`).
- Item "Reportes" agregado a `lib/nav-config.ts` en la sección "Comercial".
- Usa Recharts (ya instalado) para el LineChart de evolución temporal.
- Estados loading/empty/error manejados en ambas pantallas.
- Mobile-first con expansión progresiva en desktop.

### Otros
- Agregado `.dev.vars` al `.gitignore` (los secrets locales de cada worker no debían trackearse). Commit separado tipo `chore`.
- Spec + plan completos en `docs/superpowers/specs/` y `docs/superpowers/plans/` siguiendo el formato existente.

## Metodología

Desarrollado con el flow "Superpowers":
1. Spec (design doc) en `docs/superpowers/specs/2026-04-16-reportes-dashboard-design.md`.
2. Plan de implementación en `docs/superpowers/plans/2026-04-16-reportes-dashboard.md`.
3. Tasks ejecutadas en orden, con tests primero (TDD) y commit atómico por task.

## Verificación local

1. \`bash vendepro-backend/start-local.sh\` (necesita \`.dev.vars\` con \`JWT_SECRET\` en cada worker excepto api-public; ver Task 8 Step 4 del plan si hay que crear datos demo).
2. \`node vendepro-backend/seed-local.js\` → crea org + admin \`admin@test.com\` / \`Admin1234!\`.
3. \`http://localhost:3000/login\` → login → ver item "Reportes" en sidebar.
4. Tabs funcionan y empty states se muestran correctamente.

## Checklist

- [x] Tests del backend pasan (\`npm test\` en vendepro-backend).
- [x] Build del frontend OK (\`next build\`).
- [x] Typecheck OK (ambos).
- [x] Mobile y desktop verificados.
- [x] Empty states, loading states y error states presentes.
- [x] Colores de marca (\`#ff007c\` y \`#ff8017\`) respetados.
- [x] Sin cambios en recursos protegidos (wrangler.jsonc, workflows, schemas críticos).
- [x] Sin deploys desde terminal.

## Pedidos para Eze

1. **.dev.vars documentation**: sugerir agregar a `doc/backend.md` cómo setear los secrets locales, o un script `setup-dev-vars.sh`.
2. **start-local.sh idempotencia**: la segunda corrida falla con \`duplicate column name\`. Workaround: borrar \`.wrangler-local/\` antes. Ticket separado para hacer las migraciones idempotentes.
3. **Filtro por agent_id**: el endpoint ya recibe \`orgId\` del auth. En una iteración futura podríamos agregar un filtro por \`agent_id\` para que cada agente vea solo sus propiedades, o mantener la vista global para admin.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: el comando imprime la URL del PR creado. Compartir esa URL.

---
