'use client'

import Link from 'next/link'
import { Home, ExternalLink, Plus, FileBarChart, Clock } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { Heading, Text } from '@/components/ui/Typography'

export interface ActiveListingWithBenchmark {
  property_id: string
  address: string
  neighborhood: string
  reports_count: number
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  latest_report_published_at: string | null
  latest_report_period_label: string | null
  neighborhood_sold_avg_views_per_day: number | null
  delta_vs_neighborhood_pct: number | null
  delta_health_status: HealthStatus
}

interface Props {
  data: ActiveListingWithBenchmark[]
}

function relativeDays(iso: string | null): string | null {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff) || diff < 0) return null
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  if (days < 60) return `hace 1 mes`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} meses`
  const years = Math.floor(months / 12)
  return years === 1 ? 'hace 1 año' : `hace ${years} años`
}

function DeltaTag({ pct, status }: { pct: number | null; status: HealthStatus }) {
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
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${cfg.bg} ${cfg.border}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span className={`font-semibold text-xs ${cfg.text}`}>{prefix}{pct.toFixed(0)}%</span>
    </span>
  )
}

export default function ActiveListingsTable({ data }: Props) {
  if (data.length === 0) return null

  const noReportCount = data.filter(r => r.reports_count === 0).length

  const columns: Column<ActiveListingWithBenchmark>[] = [
    {
      key: 'address',
      header: 'Propiedad',
      render: row => (
        <>
          <Link
            href={`/propiedades/${row.property_id}/reportes`}
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            onClick={e => e.stopPropagation()}
          >
            {row.address}
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </Link>
          {row.reports_count > 0 ? (
            <Text size="xs" tone="muted" className="mt-0.5">
              {row.reports_count} reporte{row.reports_count !== 1 ? 's' : ''} · {row.avg_in_person_visits_per_week} vis pres/sem
            </Text>
          ) : (
            <Text size="xs" weight="medium" className="mt-0.5 text-warning inline-flex items-center gap-1">
              <FileBarChart className="w-3 h-3" aria-hidden="true" />
              Sin reportes aún
            </Text>
          )}
        </>
      ),
    },
    { key: 'neighborhood', header: 'Barrio', hideBelow: 'sm', render: row => <span className="text-gray-600">{row.neighborhood}</span> },
    {
      key: 'latest',
      header: 'Último reporte',
      hideBelow: 'md',
      render: row => {
        const ago = relativeDays(row.latest_report_published_at)
        if (!ago) return <span className="text-gray-400 text-xs">—</span>
        return (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3 text-gray-400" aria-hidden="true" />
            {ago}
            {row.latest_report_period_label && (
              <span className="text-gray-400"> · {row.latest_report_period_label}</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'avg_views_per_day',
      header: 'Vis/día',
      align: 'right',
      render: row => row.reports_count > 0
        ? (
          <>
            <span className="font-semibold text-ink">{row.avg_views_per_day}</span>
            <Text size="xs" as="span" tone="muted" className="ml-0.5">vis/día</Text>
          </>
        )
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'benchmark',
      header: 'Benchmark',
      align: 'right',
      hideBelow: 'lg',
      render: row => (
        <span className="text-gray-500">
          {row.neighborhood_sold_avg_views_per_day !== null
            ? `${row.neighborhood_sold_avg_views_per_day} vis/día`
            : '—'}
        </span>
      ),
    },
    {
      key: 'delta',
      header: 'vs barrio',
      align: 'right',
      render: row => row.reports_count > 0
        ? <DeltaTag pct={row.delta_vs_neighborhood_pct} status={row.delta_health_status} />
        : <span className="text-gray-300 text-xs">—</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: row => (
        <Link
          href={`/propiedades/${row.property_id}/reportes/nuevo`}
          onClick={e => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors"
          title="Crear nuevo reporte"
        >
          <Plus className="w-3 h-3" aria-hidden="true" />
          <span className="hidden md:inline">Nuevo</span>
        </Link>
      ),
    },
  ]

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <Home className="w-4 h-4 text-gray-600" aria-hidden="true" />
          <Heading level={4}>Mis avisos activos</Heading>
          {noReportCount > 0 && (
            <Badge tone="warning" className="ml-auto">{noReportCount} sin reportes aún</Badge>
          )}
        </div>
        <Text size="xs" tone="muted" className="mt-1.5">
          Cada aviso comparado contra el promedio de vendidas de su barrio — los que más se alejan aparecen primero.
        </Text>
      </div>

      <Table
        columns={columns}
        data={data}
        rowKey={row => row.property_id}
        className="border-0 rounded-none"
        expandedContent={row =>
          row.delta_vs_neighborhood_pct !== null
            && row.delta_vs_neighborhood_pct < -10
            && row.neighborhood_sold_avg_views_per_day !== null
            ? (
              <DiagnosisCard
                neighborhood={row.neighborhood}
                deltaPct={row.delta_vs_neighborhood_pct}
                activeViewsPerDay={row.avg_views_per_day}
                soldViewsPerDay={row.neighborhood_sold_avg_views_per_day}
              />
            )
            : null
        }
      />
    </Card>
  )
}
