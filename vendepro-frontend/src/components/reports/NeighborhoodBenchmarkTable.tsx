'use client'

import { Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { Heading, Text } from '@/components/ui/Typography'

export interface NeighborhoodGroupMetrics {
  property_count: number
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

interface Props {
  data: NeighborhoodComparison[]
}

function DeltaCell({ pct, status }: { pct: number | null; status: HealthStatus }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-400 text-xs">
        <HealthBadge status={status} size="sm" />
        Sin benchmark
      </span>
    )
  }
  const cfg = HEALTH_COLORS[status]
  const prefix = pct >= 0 ? '+' : ''
  const Icon = pct >= 0 ? TrendingUp : pct < -10 ? TrendingDown : Minus
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
      <Icon className={`w-3 h-3 ${cfg.text}`} aria-hidden="true" />
      <span className={`font-semibold text-xs ${cfg.text}`}>{prefix}{pct.toFixed(0)}%</span>
    </span>
  )
}

function ViewsCell({ metrics }: { metrics: NeighborhoodGroupMetrics | null }) {
  if (!metrics) return <span className="text-gray-300">—</span>
  return (
    <>
      <span className="font-semibold text-ink">{metrics.avg_views_per_day}</span>
      <Text size="xs" as="span" tone="muted" className="ml-0.5">vis/día</Text>
    </>
  )
}

export default function NeighborhoodBenchmarkTable({ data }: Props) {
  const hasAnyData = data.some(d => d.active !== null)
  if (!hasAnyData) return null

  const columns: Column<NeighborhoodComparison>[] = [
    {
      key: 'neighborhood',
      header: 'Barrio',
      render: row => (
        <>
          <Text size="sm" weight="medium">{row.neighborhood}</Text>
          <Text size="xs" tone="muted" className="mt-0.5">
            {row.active?.property_count ?? 0} activos · {row.sold?.property_count ?? 0} vendidos
          </Text>
        </>
      ),
    },
    { key: 'active', header: 'Activos ∅', align: 'right', render: row => <ViewsCell metrics={row.active} /> },
    { key: 'sold', header: 'Vendidos ∅', align: 'right', render: row => <ViewsCell metrics={row.sold} /> },
    {
      key: 'visits',
      header: 'Vis. pres./sem',
      align: 'right',
      hideBelow: 'sm',
      render: row => row.active
        ? (
          <>
            {row.active.avg_in_person_visits_per_week}
            {row.sold && <Text size="xs" as="span" tone="muted"> / {row.sold.avg_in_person_visits_per_week}</Text>}
          </>
        )
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'diagnosis',
      header: 'Diagnóstico',
      align: 'right',
      render: row => <DeltaCell pct={row.delta_views_per_day_pct} status={row.delta_health_status} />,
    },
  ]

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <Scale className="w-4 h-4 text-gray-600" aria-hidden="true" />
          <Heading level={4}>Tus activos vs vendidos — resumen por barrio</Heading>
        </div>
        <Text size="xs" tone="muted" className="mt-1.5">
          ¿Cómo vienen tus avisos contra los que se vendieron? (promedio por barrio)
        </Text>
      </div>

      <Table
        columns={columns}
        data={data}
        rowKey={row => row.neighborhood}
        className="border-0 rounded-none"
        // El detalle sólo aparece cuando el barrio está más de 10% por debajo
        // de su benchmark y hay con qué compararlo.
        expandedContent={row =>
          row.delta_views_per_day_pct !== null
            && row.delta_views_per_day_pct < -10
            && row.active
            && row.sold
            ? (
              <DiagnosisCard
                neighborhood={row.neighborhood}
                deltaPct={row.delta_views_per_day_pct}
                activeViewsPerDay={row.active.avg_views_per_day}
                soldViewsPerDay={row.sold.avg_views_per_day}
              />
            )
            : null
        }
      />
    </Card>
  )
}
