# Benchmark comparativo Activos vs Vendidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los umbrales fijos del semáforo (14/8 MG) por un benchmark calculado internamente: comparar cada barrio y cada aviso contra el promedio de los **avisos vendidos de la misma org en ese barrio**. Dashboard se vuelve herramienta de diagnóstico comercial.

**Architecture:** Nuevo helper SQL `getComparisonByNeighborhood` con 3 queries paralelas (sold-metrics, active-metrics, distinct-days) que devuelve por barrio totales sold vs active + delta%. El endpoint `/listings-performance` expone `comparison_by_neighborhood` en el response. Frontend agrega una tabla comparativa arriba de todo + cartel de diagnóstico expandible.

**Tech Stack:** Igual que PRs previos. Sin cambios de schema.

**Depende de:** PR #2 `feature/semaforo-visualizaciones`. Esta branch se creó desde ahí. Si PR #2 se mergea primero: `git rebase main` en esta.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `vendepro-backend/packages/api-analytics/src/reports-queries.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/src/index.ts` |
| Modificar | `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts` |
| Modificar | `vendepro-backend/seed-demo-reports.sql` |
| Crear | `vendepro-frontend/src/components/reports/NeighborhoodBenchmarkTable.tsx` |
| Crear | `vendepro-frontend/src/components/reports/DiagnosisCard.tsx` |
| Modificar | `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx` |

---

## Task 1: Helper `getComparisonByNeighborhood` + `computeDeltaHealthStatus`

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/src/reports-queries.ts`

- [ ] **Step 1: Agregar tipos al final del archivo**

```typescript
// ── Comparison Activos vs Vendidos ─────────────────────────────

export interface NeighborhoodGroupMetrics {
  reports_count: number
  avg_views_per_day: number
  avg_portal_visits_per_report: number
  avg_in_person_visits_per_week: number
  avg_inquiries_per_report: number
}

export interface NeighborhoodComparison {
  neighborhood: string
  sold: NeighborhoodGroupMetrics | null
  active: NeighborhoodGroupMetrics | null
  delta_views_per_day_pct: number | null
  delta_health_status: HealthStatus
}

/** Semáforo basado en el delta% vs benchmark del barrio.
 *  null delta (sin vendidas) → light_green (sin-data, neutral). */
export function computeDeltaHealthStatus(deltaPct: number | null): HealthStatus {
  if (deltaPct === null) return 'light_green'
  if (deltaPct >= -10) return 'green'
  if (deltaPct >= -30) return 'yellow'
  return 'red'
}
```

- [ ] **Step 2: Agregar la función helper**

Al final de `reports-queries.ts`:

```typescript
/** Devuelve por barrio los promedios ponderados de las métricas,
 *  separados entre propiedades 'sold' y 'active'. */
export async function getComparisonByNeighborhood(
  db: D1Database,
  orgId: string,
): Promise<NeighborhoodComparison[]> {

  /** Query genérica: para un status de property (sold o active),
   *  devuelve un array de { neighborhood, reports_count, total_*, total_days }. */
  const queryGroup = async (status: 'sold' | 'active') => {
    const [metricsRes, daysRes] = await Promise.all([
      db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COUNT(DISTINCT r.id) AS reports_count,
          COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
          COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits,
          COALESCE(SUM(rm.inquiries), 0) AS total_inquiries
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        LEFT JOIN report_metrics rm ON rm.report_id = r.id
        WHERE p.org_id = ?
          AND p.status = ?
          AND r.status = 'published'
        GROUP BY p.neighborhood
      `).bind(orgId, status).all(),
      db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COALESCE(SUM(julianday(r.period_end) - julianday(r.period_start)), 0) AS total_period_days
        FROM (
          SELECT DISTINCT r.id, r.period_start, r.period_end, r.property_id
          FROM reports r
          JOIN properties p ON p.id = r.property_id
          WHERE p.org_id = ?
            AND p.status = ?
            AND r.status = 'published'
        ) r
        JOIN properties p ON p.id = r.property_id
        GROUP BY p.neighborhood
      `).bind(orgId, status).all(),
    ])
    const daysMap: Record<string, number> = {}
    for (const row of (daysRes.results as any[] ?? [])) {
      daysMap[String(row.neighborhood ?? 'Sin barrio')] = Math.max(1, Math.round(Number(row.total_period_days ?? 0)))
    }
    return ((metricsRes.results as any[]) ?? []).map(r => {
      const count = Number(r.reports_count ?? 0)
      const totalPortal = Number(r.total_portal_visits ?? 0)
      const totalInPerson = Number(r.total_in_person_visits ?? 0)
      const totalInquiries = Number(r.total_inquiries ?? 0)
      const totalDays = daysMap[String(r.neighborhood ?? 'Sin barrio')] ?? 1
      return {
        neighborhood: String(r.neighborhood ?? 'Sin barrio'),
        reports_count: count,
        total_portal_visits: totalPortal,
        total_in_person_visits: totalInPerson,
        total_inquiries: totalInquiries,
        total_days: totalDays,
      }
    })
  }

  const toMetrics = (x: Awaited<ReturnType<typeof queryGroup>>[number] | undefined): NeighborhoodGroupMetrics | null => {
    if (!x || x.reports_count === 0) return null
    return {
      reports_count: x.reports_count,
      avg_views_per_day: Math.round((x.total_portal_visits / x.total_days) * 10) / 10,
      avg_portal_visits_per_report: Math.round(x.total_portal_visits / x.reports_count),
      avg_in_person_visits_per_week: Math.round((x.total_in_person_visits / (x.total_days / 7)) * 10) / 10,
      avg_inquiries_per_report: Math.round((x.total_inquiries / x.reports_count) * 10) / 10,
    }
  }

  const [soldRows, activeRows] = await Promise.all([queryGroup('sold'), queryGroup('active')])

  const neighborhoods = new Set<string>([
    ...soldRows.map(r => r.neighborhood),
    ...activeRows.map(r => r.neighborhood),
  ])

  return [...neighborhoods].map(n => {
    const soldRow = soldRows.find(r => r.neighborhood === n)
    const activeRow = activeRows.find(r => r.neighborhood === n)
    const sold = toMetrics(soldRow)
    const active = toMetrics(activeRow)

    let delta: number | null = null
    if (sold && active && sold.avg_views_per_day > 0) {
      delta = Math.round(((active.avg_views_per_day - sold.avg_views_per_day) / sold.avg_views_per_day) * 1000) / 10
    }

    return {
      neighborhood: n,
      sold,
      active,
      delta_views_per_day_pct: delta,
      delta_health_status: computeDeltaHealthStatus(delta),
    }
  }).sort((a, b) => {
    // Barrios con más reports activos primero
    const aActive = a.active?.reports_count ?? 0
    const bActive = b.active?.reports_count ?? 0
    return bActive - aActive
  })
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd vendepro-backend
npx tsc --noEmit -p packages/api-analytics/tsconfig.json 2>&1 | grep "reports-queries" ; echo "exit $?"
```

Expected: sin errores en `reports-queries.ts`.

```bash
git add packages/api-analytics/src/reports-queries.ts
git commit -m "feat(api-analytics): getComparisonByNeighborhood (sold vs active)"
```

---

## Task 2: Extender `/listings-performance` con `comparison_by_neighborhood`

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/src/index.ts`

- [ ] **Step 1: Importar la función nueva**

```typescript
import {
  // ...
  getComparisonByNeighborhood,
  // ...
} from './reports-queries'
```

- [ ] **Step 2: Llamarla en el endpoint en paralelo con las demás**

Dentro del handler del endpoint, agregar a la `Promise.all`:

```typescript
const [kpis, byNeighborhood, timeline, comparison] = await Promise.all([
  safe(() => getPerformanceKpis(db, orgId, start, end, source), emptyKpis),
  safe(() => getNeighborhoodPerformance(db, orgId, start, end, source), []),
  safe(() => getTimelinePerformance(db, orgId, start, end, source), []),
  safe(() => getComparisonByNeighborhood(db, orgId), []),
])
```

Y en el return:

```typescript
return c.json({
  period,
  start,
  end,
  kpis,
  by_neighborhood: byNeighborhood,
  timeline,
  benchmarks: BENCHMARKS,
  comparison_by_neighborhood: comparison,
})
```

- [ ] **Step 3: Commit**

```bash
git add packages/api-analytics/src/index.ts
git commit -m "feat(api-analytics): endpoint expone comparison_by_neighborhood"
```

---

## Task 3: Tests del backend

**Files:**
- Modify: `vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts`

- [ ] **Step 1: Agregar mock de `getComparisonByNeighborhood`**

En el `vi.mock('../src/reports-queries', ...)` agregar:

```typescript
  getComparisonByNeighborhood: vi.fn().mockResolvedValue([
    {
      neighborhood: 'Villa Urquiza',
      sold: {
        reports_count: 5,
        avg_views_per_day: 45,
        avg_portal_visits_per_report: 500,
        avg_in_person_visits_per_week: 2.5,
        avg_inquiries_per_report: 12,
      },
      active: {
        reports_count: 3,
        avg_views_per_day: 22,
        avg_portal_visits_per_report: 300,
        avg_in_person_visits_per_week: 1.2,
        avg_inquiries_per_report: 6,
      },
      delta_views_per_day_pct: -51.1,
      delta_health_status: 'red',
    },
  ]),
  computeDeltaHealthStatus: vi.fn(),
```

- [ ] **Step 2: Agregar un test**

```typescript
  it('includes comparison_by_neighborhood with sold and active groups', async () => {
    const { default: app } = await import('../src/index')
    const res = await app.request('/listings-performance', { method: 'GET' }, { DB: {}, JWT_SECRET: 'secret' })
    const body = await res.json() as any

    expect(body.comparison_by_neighborhood).toBeDefined()
    expect(body.comparison_by_neighborhood).toHaveLength(1)
    expect(body.comparison_by_neighborhood[0].neighborhood).toBe('Villa Urquiza')
    expect(body.comparison_by_neighborhood[0].sold.avg_views_per_day).toBe(45)
    expect(body.comparison_by_neighborhood[0].active.avg_views_per_day).toBe(22)
    expect(body.comparison_by_neighborhood[0].delta_views_per_day_pct).toBe(-51.1)
    expect(body.comparison_by_neighborhood[0].delta_health_status).toBe('red')
  })
```

- [ ] **Step 3: Correr tests**

```bash
cd vendepro-backend/packages/api-analytics
npm test 2>&1 | tail -8
```

Expected: 10/10 tests pasan (los 9 previos + 1 nuevo).

- [ ] **Step 4: Commit**

```bash
cd ../../..
git add vendepro-backend/packages/api-analytics/tests/listings-performance.test.ts
git commit -m "test(api-analytics): test para comparison_by_neighborhood"
```

---

## Task 4: Seed con propiedad vendida

**Files:**
- Modify: `vendepro-backend/seed-demo-reports.sql`

- [ ] **Step 1: Agregar una propiedad vendida con sus reports**

Al final del archivo, antes de `-- Done.`:

```sql
-- ── Propiedad vendida (benchmark para comparativa) ─────────────
INSERT OR IGNORE INTO properties (
  id, org_id, address, neighborhood, city, property_type,
  rooms, size_m2, asking_price, currency,
  owner_name, public_slug, agent_id, status,
  sold_price, sold_date, days_on_market
) VALUES
  ('prop-demo-urquiza-sold',
   (SELECT id FROM organizations WHERE slug = 'test-local'),
   'Álvarez Thomas 2750', 'Villa Urquiza', 'Capital Federal', 'departamento',
   3, 65, 135000, 'USD',
   'Propietario Vendida', 'alvarez-thomas-2750-villa-urquiza',
   (SELECT id FROM users WHERE email = 'admin@test.com'), 'sold',
   130000, '2026-03-15', 90);

INSERT OR IGNORE INTO reports (
  id, property_id, period_label, period_start, period_end,
  status, created_by, published_at
) VALUES
  ('rep-urquiza-sold-ene', 'prop-demo-urquiza-sold',
   'Enero 2026', '2026-01-01', '2026-01-31',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-02-01T10:00:00Z'),
  ('rep-urquiza-sold-feb', 'prop-demo-urquiza-sold',
   'Febrero 2026', '2026-02-01', '2026-02-28',
   'published',
   (SELECT id FROM users WHERE email = 'admin@test.com'),
   '2026-03-01T10:00:00Z');

-- Propiedad vendida tuvo buen desempeño: 35 vis/día (verde)
INSERT OR IGNORE INTO report_metrics (
  id, report_id, source, impressions, portal_visits, inquiries,
  phone_calls, whatsapp, in_person_visits, offers
) VALUES
  ('rm-urquiza-sold-ene-zp', 'rep-urquiza-sold-ene', 'zonaprop',
   18000, 1085, 25, 4, 6, 8, 2),
  ('rm-urquiza-sold-feb-zp', 'rep-urquiza-sold-feb', 'zonaprop',
   16500, 980, 18, 2, 4, 6, 3);
```

- [ ] **Step 2: Aplicar el seed**

```bash
cd vendepro-backend
npx wrangler d1 execute DB --local \
  --persist-to .wrangler-local \
  --config packages/api-auth/wrangler.jsonc \
  --file seed-demo-reports.sql
```

- [ ] **Step 3: Probar endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:8787/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin1234!"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8791/listings-performance?period=year" \
  | sed 's/.*"comparison_by_neighborhood":\(\[[^]]*\]\).*/\1/'
```

Expected: el response incluye comparación para Villa Urquiza con `sold` y `active`, y delta negativo (porque los activos tienen 22 vis/día y la vendida ~35).

- [ ] **Step 4: Commit**

```bash
cd ..
git add vendepro-backend/seed-demo-reports.sql
git commit -m "chore(backend): seed con propiedad vendida para probar benchmark comparativo"
```

---

## Task 5: Componente `DiagnosisCard`

**Files:**
- Create: `vendepro-frontend/src/components/reports/DiagnosisCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// vendepro-frontend/src/components/reports/DiagnosisCard.tsx
import { AlertTriangle, Camera, Map, Video, Share2, DollarSign, Box } from 'lucide-react'

interface DiagnosisCardProps {
  neighborhood: string
  deltaPct: number
  activeViewsPerDay: number
  soldViewsPerDay: number
}

const STEPS = [
  { icon: DollarSign, label: 'Precio de publicación', hint: '¿está dentro de mercado?' },
  { icon: Camera,     label: 'Fotos profesionales',   hint: '36+ fotos de buena calidad' },
  { icon: Box,        label: 'Tour Virtual 360°',     hint: 'recorrido inmersivo' },
  { icon: Map,        label: 'Plano',                 hint: 'dimensiones y distribución' },
  { icon: Video,      label: 'Video',                 hint: '30-60 segundos editado' },
  { icon: Share2,     label: 'Redes sociales',        hint: 'YouTube, Instagram, etc.' },
]

export default function DiagnosisCard({
  neighborhood,
  deltaPct,
  activeViewsPerDay,
  soldViewsPerDay,
}: DiagnosisCardProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-800 text-sm sm:text-base">
            Tus activos en {neighborhood} están {Math.abs(deltaPct).toFixed(0)}% por debajo de los vendidos
          </p>
          <p className="text-xs sm:text-sm text-red-600 mt-0.5">
            Tus activos: <strong>{activeViewsPerDay} vis/día</strong> ·
            Los que vendiste: <strong>{soldViewsPerDay} vis/día</strong>
          </p>
          <p className="text-xs text-gray-600 mt-3 mb-2">
            Revisá los <strong>5 pasos de comercialización</strong> (Marcela Genta):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="flex items-start gap-2 text-xs">
                  <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-gray-700">{s.label}</p>
                    <p className="text-gray-500 text-[10px]">{s.hint}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd vendepro-frontend
git add src/components/reports/DiagnosisCard.tsx
git commit -m "feat(frontend): DiagnosisCard con los 5 pasos MG"
```

---

## Task 6: Componente `NeighborhoodBenchmarkTable`

**Files:**
- Create: `vendepro-frontend/src/components/reports/NeighborhoodBenchmarkTable.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// vendepro-frontend/src/components/reports/NeighborhoodBenchmarkTable.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Scale } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import type { HealthStatus } from '@/lib/semaforo'

export interface NeighborhoodComparison {
  neighborhood: string
  sold: {
    reports_count: number
    avg_views_per_day: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_week: number
    avg_inquiries_per_report: number
  } | null
  active: {
    reports_count: number
    avg_views_per_day: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_week: number
    avg_inquiries_per_report: number
  } | null
  delta_views_per_day_pct: number | null
  delta_health_status: HealthStatus
}

interface Props {
  data: NeighborhoodComparison[]
}

function DeltaCell({ pct, status }: { pct: number | null; status: HealthStatus }) {
  if (pct === null) return <span className="text-gray-400 text-xs">Sin data</span>
  const prefix = pct >= 0 ? '+' : ''
  return (
    <span className="inline-flex items-center gap-2">
      <HealthBadge status={status} size="sm" />
      <span className={`font-semibold ${pct < -10 ? 'text-red-600' : pct < 0 ? 'text-yellow-700' : 'text-green-700'}`}>
        {prefix}{pct.toFixed(0)}%
      </span>
    </span>
  )
}

export default function NeighborhoodBenchmarkTable({ data }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const hasAnyData = data.some(d => d.active !== null)
  if (!hasAnyData) return null

  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
        <h2 className="font-semibold text-gray-800">Tus activos vs vendidos</h2>
        <span className="text-xs text-gray-500">— ¿cómo vienen tus avisos contra los que se vendieron?</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-2 w-8"></th>
              <th className="pb-2 pr-4">Barrio</th>
              <th className="pb-2 px-2 text-right">Activos ∅</th>
              <th className="pb-2 px-2 text-right">Vendidos ∅</th>
              <th className="pb-2 px-2 text-right hidden sm:table-cell">Visitas/sem activos</th>
              <th className="pb-2 px-2 text-right hidden md:table-cell">Visitas/sem vendidos</th>
              <th className="pb-2 pl-2 text-right">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => {
              const expanded = expandedKey === row.neighborhood
              const showDiagnosis = row.delta_views_per_day_pct !== null && row.delta_views_per_day_pct < -10 && row.active && row.sold
              return (
                <>
                  <tr key={row.neighborhood} className={`hover:bg-gray-50 ${showDiagnosis ? 'cursor-pointer' : ''}`} onClick={showDiagnosis ? () => setExpandedKey(expanded ? null : row.neighborhood) : undefined}>
                    <td className="py-2 pr-2">
                      {showDiagnosis && (expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
                    </td>
                    <td className="py-2 pr-4 font-medium text-gray-800">{row.neighborhood}</td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {row.active ? `${row.active.avg_views_per_day} vis/día` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {row.sold ? `${row.sold.avg_views_per_day} vis/día` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600 hidden sm:table-cell">
                      {row.active ? row.active.avg_in_person_visits_per_week : '—'}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600 hidden md:table-cell">
                      {row.sold ? row.sold.avg_in_person_visits_per_week : '—'}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <DeltaCell pct={row.delta_views_per_day_pct} status={row.delta_health_status} />
                    </td>
                  </tr>
                  {expanded && showDiagnosis && row.active && row.sold && (
                    <tr>
                      <td colSpan={7} className="px-2 pb-3">
                        <DiagnosisCard
                          neighborhood={row.neighborhood}
                          deltaPct={row.delta_views_per_day_pct!}
                          activeViewsPerDay={row.active.avg_views_per_day}
                          soldViewsPerDay={row.sold.avg_views_per_day}
                        />
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reports/NeighborhoodBenchmarkTable.tsx
git commit -m "feat(frontend): NeighborhoodBenchmarkTable con expand a diagnóstico"
```

---

## Task 7: Integrar tabla comparativa en `/reportes/performance`

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/reportes/performance/page.tsx`

- [ ] **Step 1: Actualizar la interface `PerformanceData`**

Agregar el campo `comparison_by_neighborhood`:

```typescript
interface PerformanceData {
  // ... campos existentes
  comparison_by_neighborhood?: Array<import('@/components/reports/NeighborhoodBenchmarkTable').NeighborhoodComparison>
}
```

Y el import:

```typescript
import NeighborhoodBenchmarkTable from '@/components/reports/NeighborhoodBenchmarkTable'
```

- [ ] **Step 2: Renderizar la tabla arriba de todo**

Inmediatamente después del bloque de leyenda del semáforo (antes del `!hasData` block), agregar:

```tsx
      {data.comparison_by_neighborhood && data.comparison_by_neighborhood.length > 0 && (
        <NeighborhoodBenchmarkTable data={data.comparison_by_neighborhood} />
      )}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd vendepro-frontend
npx tsc --noEmit 2>&1 | grep "reportes/performance" ; echo "exit $?"
```

Expected: sin errores.

```bash
git add src/app/\(dashboard\)/reportes/performance/page.tsx
git commit -m "feat(frontend): inyectar NeighborhoodBenchmarkTable en /reportes/performance"
```

---

## Task 8: Verificación integral y UI

- [ ] **Step 1: Tests backend**

```bash
cd vendepro-backend
npm test 2>&1 | tail -10
```

Expected: todos pasan.

- [ ] **Step 2: Curl al endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:8787/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Admin1234!"}' \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8791/listings-performance?period=year"
```

Expected: response tiene `comparison_by_neighborhood` con al menos Villa Urquiza con sold + active + delta.

- [ ] **Step 3: UI en http://localhost:3000/reportes/performance**

- [ ] Debajo de la leyenda del semáforo aparece la tabla "Tus activos vs vendidos".
- [ ] Villa Urquiza muestra activos (22 vis/día), vendidos (~35 vis/día), delta -37% aprox, rojo.
- [ ] Click en la fila → expand muestra el DiagnosisCard con los 5 pasos.
- [ ] Si el delta está cerca de 0 o positivo, no muestra el expand (verde, no hay que diagnosticar).
- [ ] Mobile y desktop se ven bien.

---

## Task 9: Push + PR #3

- [ ] **Step 1: Push**

```bash
git push -u origin feature/benchmark-comparativo
```

- [ ] **Step 2: Abrir PR**

Link: https://github.com/ezequielcorbalan/vendepro/pull/new/feature/benchmark-comparativo

Base: `feature/semaforo-visualizaciones` (o `main` si PR #2 ya fue mergeado).

Título: `feat(reportes): benchmark comparativo activos vs vendidos`
