# Semáforo de visualizaciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al dashboard de `/reportes` un semáforo de 5 colores (rojo→verde) que clasifica cada aviso y cada barrio según su performance en "visualizaciones por día", usando los umbrales de la metodología MG (14 vis/día CABA, 8 vis/día GBA como mínimo para vender en 4 meses).

**Architecture:** Cálculos puros sobre datos existentes (impressions + fechas del período) encapsulados en helpers de `reports-queries.ts`. Frontend lee los nuevos campos y pinta los colores. Sin cambios de dominio ni de DB.

**Tech Stack:** Vitest + `@cloudflare/vitest-pool-workers`, Next.js 15 App Router, Tailwind CSS 4.

**Depende de:** PR `feature/reportes-dashboard`. Esta branch se creó desde esa branch (no desde `main`). Si el PR #1 se mergea primero, hacer `git rebase main` en este.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `vendepro-backend/packages/api-analytics/src/reports-queries.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/src/index.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts` |
| Crear | `vendepro-frontend/src/lib/semaforo.ts` |
| Crear | `vendepro-frontend/src/components/reports/HealthBadge.tsx` |
| Modificar | `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` |
| Modificar | `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx` |

---

## Task 1: Helpers de semáforo en `reports-queries.ts`

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/src/reports-queries.ts`

- [ ] **Step 1: Agregar tipos y helpers puros al final del archivo**

Agregar al final de `reports-queries.ts`:

```typescript
// ── Semáforo ────────────────────────────────────────────────────
// Metodología: Marcela Genta Operaciones Inmobiliarias

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export const BENCHMARKS = {
  caba: { min_views_per_day: 14, min_in_person_visits_per_week: 1.5 },
  gba:  { min_views_per_day: 8,  min_in_person_visits_per_week: 1.0 },
  color_thresholds: {
    red:          { max_views_per_day: 9 },
    orange:       { max_views_per_day: 13 },
    yellow:       { max_views_per_day: 22 },
    light_green:  { max_views_per_day: 27 },
    green:        { min_views_per_day: 28 },
  },
  source: 'Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones',
} as const

export function computeHealthStatus(viewsPerDay: number): HealthStatus {
  if (!Number.isFinite(viewsPerDay) || viewsPerDay < 0) return 'red'
  if (viewsPerDay <= 9) return 'red'
  if (viewsPerDay <= 13) return 'orange'
  if (viewsPerDay <= 22) return 'yellow'
  if (viewsPerDay <= 27) return 'light_green'
  return 'green'
}

/** Días completos entre dos fechas ISO (YYYY-MM-DD). Mínimo 1 para evitar div/0. */
export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z').getTime()
  const end = new Date(endISO + 'T00:00:00Z').getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1
  const diffMs = end - start
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, days)
}
```

- [ ] **Step 2: Actualizar `PerformanceKpis`**

Agregar campos a la interface:

```typescript
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
  // NEW:
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  overall_health_status: HealthStatus
}
```

- [ ] **Step 3: Actualizar `getPerformanceKpis` para calcular las métricas nuevas**

Reemplazar la query y el cálculo final:

```typescript
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
      COALESCE(SUM(rm.offers), 0) AS total_offers,
      COALESCE(SUM(julianday(r.period_end) - julianday(r.period_start)), 0) AS total_period_days
    FROM reports r
    JOIN properties p ON p.id = r.property_id
    LEFT JOIN report_metrics rm ON rm.report_id = r.id
    WHERE p.org_id = ?
      AND r.status = 'published'
      AND date(r.published_at) >= ?
      AND date(r.published_at) <= ?
      ${sourceFilter}
  `).bind(...binds).first() as any

  const count = Number(row?.reports_published ?? 0)
  const totalImpressions = Number(row?.total_impressions ?? 0)
  const totalPortalVisits = Number(row?.total_portal_visits ?? 0)
  const totalInPersonVisits = Number(row?.total_in_person_visits ?? 0)
  const totalOffers = Number(row?.total_offers ?? 0)
  const totalPeriodDays = Math.max(1, Math.round(Number(row?.total_period_days ?? 0)))

  const safeAvg = (t: number): number => count > 0 ? Math.round(t / count) : 0
  const avgFloat = (t: number): number => count > 0 ? Math.round((t / count) * 100) / 100 : 0

  const avgViewsPerDay = count > 0 ? Math.round((totalImpressions / totalPeriodDays) * 10) / 10 : 0
  const avgVisitsPerWeek = count > 0 ? Math.round((totalInPersonVisits / (totalPeriodDays / 7)) * 10) / 10 : 0

  return {
    reports_published: count,
    total_impressions: totalImpressions,
    total_portal_visits: totalPortalVisits,
    total_in_person_visits: totalInPersonVisits,
    total_offers: totalOffers,
    avg_impressions_per_report: safeAvg(totalImpressions),
    avg_portal_visits_per_report: safeAvg(totalPortalVisits),
    avg_in_person_visits_per_report: safeAvg(totalInPersonVisits),
    avg_offers_per_report: avgFloat(totalOffers),
    avg_views_per_day: avgViewsPerDay,
    avg_in_person_visits_per_week: avgVisitsPerWeek,
    overall_health_status: computeHealthStatus(avgViewsPerDay),
  }
}
```

- [ ] **Step 4: Actualizar `NeighborhoodPerformance` + query**

Agregar a la interface:

```typescript
export interface NeighborhoodPerformance {
  neighborhood: string
  reports_count: number
  avg_impressions: number
  avg_portal_visits: number
  avg_in_person_visits: number
  avg_offers: number
  total_offers: number
  // NEW:
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  health_status: HealthStatus
}
```

Actualizar la query y el mapeo de `getNeighborhoodPerformance`:

```typescript
  const res = await db.prepare(`
    SELECT
      p.neighborhood AS neighborhood,
      COUNT(DISTINCT r.id) AS reports_count,
      COALESCE(ROUND(AVG(rm.impressions)), 0) AS avg_impressions,
      COALESCE(ROUND(AVG(rm.portal_visits)), 0) AS avg_portal_visits,
      COALESCE(ROUND(AVG(rm.in_person_visits)), 0) AS avg_in_person_visits,
      COALESCE(ROUND(AVG(rm.offers) * 100) / 100.0, 0) AS avg_offers,
      COALESCE(SUM(rm.offers), 0) AS total_offers,
      COALESCE(SUM(rm.impressions), 0) AS total_impressions,
      COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits,
      COALESCE(SUM(julianday(r.period_end) - julianday(r.period_start)), 0) AS total_period_days
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

  return ((res.results as any[]) ?? []).map(r => {
    const totalImpressions = Number(r.total_impressions ?? 0)
    const totalInPersonVisits = Number(r.total_in_person_visits ?? 0)
    const totalDays = Math.max(1, Math.round(Number(r.total_period_days ?? 0)))
    const viewsPerDay = Math.round((totalImpressions / totalDays) * 10) / 10
    const visitsPerWeek = Math.round((totalInPersonVisits / (totalDays / 7)) * 10) / 10
    return {
      neighborhood: r.neighborhood ?? 'Sin barrio',
      reports_count: Number(r.reports_count ?? 0),
      avg_impressions: Number(r.avg_impressions ?? 0),
      avg_portal_visits: Number(r.avg_portal_visits ?? 0),
      avg_in_person_visits: Number(r.avg_in_person_visits ?? 0),
      avg_offers: Number(r.avg_offers ?? 0),
      total_offers: Number(r.total_offers ?? 0),
      avg_views_per_day: viewsPerDay,
      avg_in_person_visits_per_week: visitsPerWeek,
      health_status: computeHealthStatus(viewsPerDay),
    }
  })
```

- [ ] **Step 5: Actualizar `ReportListItem` + `listReportsWithMetrics`**

Agregar a la interface:

```typescript
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
  // NEW:
  days_in_period: number
  views_per_day: number
  in_person_visits_per_week: number
  health_status: HealthStatus | null
}
```

Actualizar el map final de `listReportsWithMetrics`:

```typescript
  const results = ((rowsRes.results as any[]) ?? []).map(r => {
    const impressions = Number(r.impressions ?? 0)
    const inPersonVisits = Number(r.in_person_visits ?? 0)
    const days = daysBetween(r.period_start ?? '', r.period_end ?? '')
    const viewsPerDay = Math.round((impressions / days) * 10) / 10
    const visitsPerWeek = Math.round((inPersonVisits / (days / 7)) * 10) / 10
    const healthStatus: HealthStatus | null =
      (r.period_start && r.period_end) ? computeHealthStatus(viewsPerDay) : null
    return {
      id: r.id,
      property_id: r.property_id,
      property_address: r.property_address ?? '',
      property_neighborhood: r.property_neighborhood ?? 'Sin barrio',
      period_label: r.period_label ?? '',
      period_start: r.period_start ?? '',
      period_end: r.period_end ?? '',
      status: r.status ?? 'draft',
      published_at: r.published_at ?? null,
      impressions,
      portal_visits: Number(r.portal_visits ?? 0),
      in_person_visits: inPersonVisits,
      offers: Number(r.offers ?? 0),
      days_in_period: days,
      views_per_day: viewsPerDay,
      in_person_visits_per_week: visitsPerWeek,
      health_status: healthStatus,
    }
  })
```

- [ ] **Step 6: Typecheck y commit**

```bash
cd vendepro-backend
npx tsc --noEmit -p packages/api-analytics/tsconfig.json 2>&1 | grep "reports-queries" ; echo "exit $?"
```

Expected: sin errores en `reports-queries.ts`.

```bash
git add packages/api-analytics/src/reports-queries.ts
git commit -m "feat(api-analytics): semáforo y métricas normalizadas (vis/día, vis pres/sem)"
```

---

## Task 2: Endpoint `/listings-performance` devuelve `benchmarks`

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/src/index.ts`

- [ ] **Step 1: Importar `BENCHMARKS` y agregarlo al response**

Agregar al import:

```typescript
import {
  periodStartDate,
  getPerformanceKpis,
  getNeighborhoodPerformance,
  getTimelinePerformance,
  listReportsWithMetrics,
  BENCHMARKS,
  type Period,
} from './reports-queries'
```

Modificar el `return c.json(...)` del endpoint `/listings-performance` para incluir `benchmarks`:

```typescript
  return c.json({
    period,
    start,
    end,
    kpis,
    by_neighborhood: byNeighborhood,
    timeline,
    benchmarks: BENCHMARKS,
  })
```

Actualizar también el `emptyKpis` para incluir los campos nuevos:

```typescript
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
    avg_views_per_day: 0,
    avg_in_person_visits_per_week: 0,
    overall_health_status: 'red' as const,
  }
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p packages/api-analytics/tsconfig.json 2>&1 | grep "api-analytics/src/index" ; echo "exit $?"
```

Expected: sin errores en el índice del api-analytics.

- [ ] **Step 3: Commit**

```bash
git add packages/api-analytics/src/index.ts
git commit -m "feat(api-analytics): endpoint devuelve benchmarks del semáforo"
```

---

## Task 3: Actualizar tests del backend

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts`
- Modify: `vendepro-backend/packages/api-analytics/tests/reports-list.test.ts`

- [ ] **Step 1: Actualizar mock y tests de `listings-performance.test.ts`**

Reemplazar el `mockKpis` para incluir los campos nuevos:

```typescript
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
  avg_views_per_day: 16.7,
  avg_in_person_visits_per_week: 2.3,
  overall_health_status: 'yellow' as const,
}
```

Actualizar el mock de `getNeighborhoodPerformance`:

```typescript
  getNeighborhoodPerformance: vi.fn().mockResolvedValue([
    {
      neighborhood: 'Villa Urquiza',
      reports_count: 4,
      avg_impressions: 600,
      avg_portal_visits: 50,
      avg_in_person_visits: 3,
      avg_offers: 0.5,
      total_offers: 2,
      avg_views_per_day: 20,
      avg_in_person_visits_per_week: 1.5,
      health_status: 'yellow',
    },
  ]),
```

Agregar un test nuevo:

```typescript
  it('includes benchmarks object with CABA/GBA thresholds and color_thresholds', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.benchmarks).toBeDefined()
    expect(body.benchmarks.caba.min_views_per_day).toBe(14)
    expect(body.benchmarks.gba.min_views_per_day).toBe(8)
    expect(body.benchmarks.color_thresholds.red.max_views_per_day).toBe(9)
    expect(body.benchmarks.color_thresholds.green.min_views_per_day).toBe(28)
    expect(body.benchmarks.source).toContain('Marcela Genta')
  })

  it('exposes overall_health_status from KPIs', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.kpis.overall_health_status).toBe('yellow')
    expect(body.kpis.avg_views_per_day).toBe(16.7)
  })
```

También, en el `vi.mock('../src/reports-queries', ...)`, agregar las exportaciones nuevas para que los tests no rompan:

```typescript
vi.mock('../src/reports-queries', () => ({
  periodStartDate: vi.fn().mockReturnValue('2026-03-16'),
  getPerformanceKpis: vi.fn().mockResolvedValue(mockKpis),
  getNeighborhoodPerformance: vi.fn().mockResolvedValue([ /* ... como arriba ... */ ]),
  getTimelinePerformance: vi.fn().mockResolvedValue([ /* ... como antes ... */ ]),
  listReportsWithMetrics: vi.fn().mockResolvedValue({ total: 0, results: [] }),
  computeHealthStatus: vi.fn(),
  daysBetween: vi.fn(),
  BENCHMARKS: {
    caba: { min_views_per_day: 14, min_in_person_visits_per_week: 1.5 },
    gba:  { min_views_per_day: 8,  min_in_person_visits_per_week: 1.0 },
    color_thresholds: {
      red:         { max_views_per_day: 9 },
      orange:      { max_views_per_day: 13 },
      yellow:      { max_views_per_day: 22 },
      light_green: { max_views_per_day: 27 },
      green:       { min_views_per_day: 28 },
    },
    source: 'Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones',
  },
}))
```

- [ ] **Step 2: Actualizar mock de `reports-list.test.ts`**

Agregar los campos nuevos a cada item del mock de `listReportsWithMetrics`:

```typescript
  listReportsWithMetrics: vi.fn().mockResolvedValue({
    total: 2,
    results: [
      {
        id: 'r1', property_id: 'p1',
        property_address: 'Pampa 1234', property_neighborhood: 'Villa Urquiza',
        period_label: 'Marzo 2026', period_start: '2026-03-01', period_end: '2026-03-31',
        status: 'published', published_at: '2026-04-01T10:00:00Z',
        impressions: 500, portal_visits: 40, in_person_visits: 2, offers: 1,
        days_in_period: 31, views_per_day: 16.1, in_person_visits_per_week: 0.5,
        health_status: 'yellow',
      },
      {
        id: 'r2', property_id: 'p2',
        property_address: 'Belgrano 5678', property_neighborhood: 'Belgrano',
        period_label: 'Marzo 2026', period_start: '2026-03-01', period_end: '2026-03-31',
        status: 'draft', published_at: null,
        impressions: 0, portal_visits: 0, in_person_visits: 0, offers: 0,
        days_in_period: 31, views_per_day: 0, in_person_visits_per_week: 0,
        health_status: 'red',
      },
    ],
  }),
```

Agregar `BENCHMARKS` y los helpers al mock:

```typescript
  computeHealthStatus: vi.fn(),
  daysBetween: vi.fn(),
  BENCHMARKS: { /* igual que arriba */ },
```

Agregar un test:

```typescript
  it('each result includes views_per_day and health_status', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/reports', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.results[0].views_per_day).toBeDefined()
    expect(body.results[0].health_status).toBe('yellow')
    expect(body.results[1].health_status).toBe('red')
  })
```

- [ ] **Step 3: Correr tests del api-analytics**

```bash
cd vendepro-backend/packages/api-analytics
npm test 2>&1 | tail -15
```

Expected: todos los tests pasan, incluyendo los nuevos.

- [ ] **Step 4: Commit**

```bash
cd ../../..
git add vendepro-backend/packages/api-analytics/tests/
git commit -m "test(api-analytics): actualizar mocks con campos del semáforo + tests de benchmarks"
```

---

## Task 4: Helpers de cliente para el semáforo

**Files:**
- Create: `vendepro-frontend/src/lib/semaforo.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
// vendepro-frontend/src/lib/semaforo.ts
// Helpers de cliente para el semáforo de visualizaciones
// basado en la metodología de Marcela Genta Operaciones Inmobiliarias.

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export interface HealthColor {
  bg: string
  text: string
  border: string
  dot: string
  label: string
}

export const HEALTH_COLORS: Record<HealthStatus, HealthColor> = {
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
    dot: 'bg-red-500',
    label: 'Crítico',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    dot: 'bg-orange-500',
    label: 'Bajo',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    dot: 'bg-yellow-400',
    label: 'Aceptable',
  },
  light_green: {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-300',
    dot: 'bg-lime-500',
    label: 'Bien',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-300',
    dot: 'bg-green-500',
    label: 'Excelente',
  },
}

/** Determina el estado del semáforo a partir de visualizaciones por día.
 *  Espejo de `computeHealthStatus` del backend. */
export function healthStatusFromViewsPerDay(viewsPerDay: number): HealthStatus {
  if (!Number.isFinite(viewsPerDay) || viewsPerDay <= 9) return 'red'
  if (viewsPerDay <= 13) return 'orange'
  if (viewsPerDay <= 22) return 'yellow'
  if (viewsPerDay <= 27) return 'light_green'
  return 'green'
}
```

- [ ] **Step 2: Commit**

```bash
cd vendepro-frontend
git add src/lib/semaforo.ts
git commit -m "feat(frontend): helpers de semáforo (colores Tailwind + mapeo de estados)"
```

---

## Task 5: Componente `HealthBadge`

**Files:**
- Create: `vendepro-frontend/src/components/reports/HealthBadge.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// vendepro-frontend/src/components/reports/HealthBadge.tsx
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'

interface HealthBadgeProps {
  status: HealthStatus | null
  size?: 'sm' | 'md' | 'lg'
  withLabel?: boolean
  title?: string
}

const SIZE_MAP: Record<NonNullable<HealthBadgeProps['size']>, { dot: string; text: string }> = {
  sm: { dot: 'w-2.5 h-2.5', text: 'text-[10px]' },
  md: { dot: 'w-3 h-3',     text: 'text-xs' },
  lg: { dot: 'w-4 h-4',     text: 'text-sm' },
}

export default function HealthBadge({ status, size = 'md', withLabel, title }: HealthBadgeProps) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-400" title={title ?? 'Sin datos'}>
        <span className={`${SIZE_MAP[size].dot} rounded-full bg-gray-200`} aria-hidden="true" />
        {withLabel && <span className={SIZE_MAP[size].text}>—</span>}
      </span>
    )
  }
  const cfg = HEALTH_COLORS[status]
  return (
    <span
      className={`inline-flex items-center gap-1 ${cfg.text}`}
      title={title ?? cfg.label}
    >
      <span className={`${SIZE_MAP[size].dot} rounded-full ${cfg.dot}`} aria-hidden="true" />
      {withLabel && <span className={`${SIZE_MAP[size].text} font-medium`}>{cfg.label}</span>}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/HealthBadge.tsx
git commit -m "feat(frontend): componente HealthBadge reutilizable"
```

---

## Task 6: Actualizar `/reportes/performance` con panel de leyenda + KPIs con color

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx`

- [ ] **Step 1: Actualizar la interfaz `PerformanceData`**

Agregar los campos nuevos:

```typescript
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
    avg_views_per_day: number
    avg_in_person_visits_per_week: number
    overall_health_status: 'red' | 'orange' | 'yellow' | 'light_green' | 'green'
  }
  by_neighborhood: Array<{
    neighborhood: string
    reports_count: number
    avg_impressions: number
    avg_portal_visits: number
    avg_in_person_visits: number
    avg_offers: number
    total_offers: number
    avg_views_per_day: number
    avg_in_person_visits_per_week: number
    health_status: 'red' | 'orange' | 'yellow' | 'light_green' | 'green'
  }>
  timeline: Array<{
    period_label: string
    period_start: string
    impressions: number
    portal_visits: number
    in_person_visits: number
    offers: number
  }>
  benchmarks?: {
    caba: { min_views_per_day: number; min_in_person_visits_per_week: number }
    gba:  { min_views_per_day: number; min_in_person_visits_per_week: number }
    source: string
  }
}
```

- [ ] **Step 2: Agregar imports**

```typescript
import HealthBadge from '@/components/reports/HealthBadge'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'
```

- [ ] **Step 3: Agregar el panel de leyenda justo debajo del selector de período**

Insertar entre el `div` del selector de período y el `!hasData` block:

```tsx
      {/* Leyenda del semáforo */}
      <div className="bg-white border rounded-xl p-3 sm:p-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <span className="font-medium text-gray-700">Semáforo de visualizaciones/día:</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 0–9</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 10–13</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> 14–22</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-lime-500" /> 23–27</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> +28</span>
        </div>
        <p className="text-gray-500 leading-snug">
          <strong>Mínimo para vender en 4 meses:</strong>{' '}
          CABA <strong>14 vis/día</strong> + 1.5 visitas pres./sem ·{' '}
          GBA <strong>8 vis/día</strong> + 1 visita pres./sem.
          <span className="text-gray-400"> — Marcela Genta Op. Inmobiliarias</span>
        </p>
      </div>
```

- [ ] **Step 4: Reemplazar el grid de KPIs para priorizar Vis/día**

Reemplazar el bloque completo `<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">...</div>` por:

```tsx
          {/* KPIs globales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI destacado: visualizaciones por día con color del semáforo */}
            <div className={`rounded-xl border-2 p-3 sm:p-4 ${HEALTH_COLORS[k.overall_health_status].border} ${HEALTH_COLORS[k.overall_health_status].bg}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${HEALTH_COLORS[k.overall_health_status].bg} border ${HEALTH_COLORS[k.overall_health_status].border}`} aria-hidden="true">
                <Eye className={`w-5 h-5 ${HEALTH_COLORS[k.overall_health_status].text}`} />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${HEALTH_COLORS[k.overall_health_status].text}`}>
                {k.avg_views_per_day}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Visualizaciones/día ∅</p>
              <HealthBadge status={k.overall_health_status} size="sm" withLabel />
            </div>

            <KPICard
              icon={<FileBarChart className="w-5 h-5" />}
              label="Reportes publicados"
              value={String(k.reports_published)}
              color="pink"
            />
            <KPICard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Visitas al portal ∅"
              value={String(k.avg_portal_visits_per_report)}
              sublabel={`${formatNumber(k.total_portal_visits)} total`}
              color="blue"
            />
            <KPICard
              icon={<Handshake className="w-5 h-5" />}
              label="Ofertas"
              value={String(k.total_offers)}
              sublabel={`${k.avg_offers_per_report} por aviso`}
              color="green"
            />
          </div>

          {/* Línea secundaria con métrica de visitas presenciales/semana */}
          <div className="bg-white rounded-xl border p-3 sm:p-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 mr-4">
              <Home className="w-3 h-3" aria-hidden="true" />
              Visitas presenciales: <strong className="text-gray-700">{k.avg_in_person_visits_per_week}</strong>/semana ∅
              <span className="text-gray-400">({k.total_in_person_visits} total · {k.avg_in_person_visits_per_report} por aviso)</span>
            </span>
            <span className="inline-flex items-center gap-1 mr-4">
              <Eye className="w-3 h-3" aria-hidden="true" />
              Impresiones totales: <strong className="text-gray-700">{formatNumber(k.total_impressions)}</strong>
            </span>
          </div>
```

- [ ] **Step 5: Agregar columna de semáforo al ranking de barrios**

En el `<thead>` del ranking, agregar al final:

```tsx
                      <th className="pb-2 pl-2 text-right">Ofertas</th>
                      <th className="pb-2 pl-2 text-center">Semáforo</th>
```

En cada `<tr>` del mapping, agregar al final:

```tsx
                        <td className="py-2 pl-2 text-right font-semibold text-[#ff007c]">{n.total_offers}</td>
                        <td className="py-2 pl-2 text-center">
                          <HealthBadge status={n.health_status} size="md" title={`${n.avg_views_per_day} vis/día`} />
                        </td>
```

También reemplazar la columna "∅ Impresiones" por "∅ Vis/día" (más útil dado el semáforo):

```tsx
                      <th className="pb-2 px-2 text-right">∅ Vis/día</th>
```

Y en el tr:

```tsx
                        <td className="py-2 px-2 text-right text-gray-700">{n.avg_views_per_day}</td>
```

- [ ] **Step 6: Typecheck + commit**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | grep "reportes/performance" ; echo "exit $?"
```

Expected: sin errores.

```bash
git add src/app/\(dashboard\)/reportes/performance/page.tsx
git commit -m "feat(frontend): /reportes/performance con semáforo, leyenda y KPI destacado"
```

---

## Task 7: Actualizar `/reportes/listado` con columna vis/día y badge por fila

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/reportes/listado/page.tsx`

- [ ] **Step 1: Actualizar la interface `ReportItem`**

```typescript
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
  days_in_period: number
  views_per_day: number
  in_person_visits_per_week: number
  health_status: 'red' | 'orange' | 'yellow' | 'light_green' | 'green' | null
}
```

- [ ] **Step 2: Agregar imports**

```typescript
import HealthBadge from '@/components/reports/HealthBadge'
```

- [ ] **Step 3: Ajustar la tabla**

Reemplazar el `<thead>`:

```tsx
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="py-2 px-3 w-8"></th>
                  <th className="py-2 px-3">Propiedad</th>
                  <th className="py-2 px-2 hidden sm:table-cell">Barrio</th>
                  <th className="py-2 px-2">Período</th>
                  <th className="py-2 px-2">Estado</th>
                  <th className="py-2 px-2 text-right">Vis/día</th>
                  <th className="py-2 px-2 text-right hidden md:table-cell">Visitas portal</th>
                  <th className="py-2 px-2 text-right">Ofertas</th>
                </tr>
              </thead>
```

Reemplazar cada `<tr>` del mapping:

```tsx
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <HealthBadge status={r.health_status} size="md" title={`${r.views_per_day} vis/día`} />
                    </td>
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
                    <td className="py-2 px-2 text-right text-gray-700 font-semibold">{r.views_per_day}</td>
                    <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{r.portal_visits}</td>
                    <td className="py-2 px-2 text-right font-semibold text-gray-800">{r.offers}</td>
                  </tr>
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit 2>&1 | grep "reportes/listado" ; echo "exit $?"
```

Expected: sin errores.

```bash
git add src/app/\(dashboard\)/reportes/listado/page.tsx
git commit -m "feat(frontend): /reportes/listado con columna vis/día y badge semáforo por fila"
```

---

## Task 8: Verificación integral

- [ ] **Step 1: Tests del backend**

```bash
cd vendepro-backend
npm test 2>&1 | tail -15
```

Expected: todos pasan.

- [ ] **Step 2: Probar endpoints contra stack local**

Con stack corriendo y seed-demo-reports aplicado:

```bash
TOKEN=$(curl -s -X POST http://localhost:8787/login -H "Content-Type: application/json" -d '{"email":"admin@test.com","password":"Admin1234!"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8791/listings-performance?period=year" | jq '.kpis.avg_views_per_day, .kpis.overall_health_status, .benchmarks.caba'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8791/reports" | jq '.results[0] | {views_per_day, health_status}'
```

Expected:
- `avg_views_per_day` con un número razonable para los datos de Bauness (impressions 11012 / ~23 días del período ≈ 478 vis/día → verde).
- `overall_health_status` = `green`.
- `benchmarks.caba.min_views_per_day` = 14.
- Los items de `/reports` tienen `views_per_day` y `health_status`.

- [ ] **Step 3: Verificar UI en el browser**

Navegar a `http://localhost:3000/reportes/performance`:
- [ ] Se ve la leyenda del semáforo con los 5 colores.
- [ ] El KPI "Visualizaciones/día ∅" aparece con fondo del color correspondiente.
- [ ] El ranking de barrios muestra una columna "Semáforo" con círculos de color.

Navegar a `http://localhost:3000/reportes/listado`:
- [ ] Cada fila tiene un círculo de color a la izquierda.
- [ ] La columna "Vis/día" muestra el cálculo.

---

## Task 9: Push + abrir PR #2

- [ ] **Step 1: Push**

```bash
git push -u origin feature/semaforo-visualizaciones
```

- [ ] **Step 2: Abrir PR**

Link: https://github.com/ezequielcorbalan/vendepro/pull/new/feature/semaforo-visualizaciones

Base: `feature/reportes-dashboard` (NO `main`).

Título sugerido:

```
feat(reportes): semáforo de visualizaciones (metodología MG)
```

Descripción: ver `PR2_DESCRIPTION.md` (se crea al final del trabajo).

---
