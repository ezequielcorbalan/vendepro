'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Home, ExternalLink, Plus, FileBarChart, Clock } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'

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
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (data.length === 0) return null

  const noReportCount = data.filter(r => r.reports_count === 0).length

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-gradient-to-br from-white via-white to-pink-50/30">
      <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-white to-pink-50/40 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm" aria-hidden="true">
            <Home className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-800">Mis avisos activos</h2>
          {noReportCount > 0 && (
            <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {noReportCount} sin reportes aún
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Cada aviso comparado contra el promedio de vendidas de su barrio — los que más se alejan aparecen primero.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50/50 border-b border-gray-100">
              <th className="py-2.5 pl-4 pr-2 w-8"></th>
              <th className="py-2.5 px-2">Propiedad</th>
              <th className="py-2.5 px-2 hidden sm:table-cell">Barrio</th>
              <th className="py-2.5 px-2 hidden md:table-cell">Último reporte</th>
              <th className="py-2.5 px-2 text-right">Vis/día</th>
              <th className="py-2.5 px-2 text-right hidden lg:table-cell">Benchmark</th>
              <th className="py-2.5 px-2 text-right">vs barrio</th>
              <th className="py-2.5 pr-4 pl-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => {
              const expanded = expandedKey === row.property_id
              const showDiagnosis = row.delta_vs_neighborhood_pct !== null
                && row.delta_vs_neighborhood_pct < -10
                && row.neighborhood_sold_avg_views_per_day !== null
              const hasReports = row.reports_count > 0
              const latestAgo = relativeDays(row.latest_report_published_at)

              return (
                <Fragment key={row.property_id}>
                  <tr
                    className={`hover:bg-pink-50/20 transition-colors ${showDiagnosis ? 'cursor-pointer' : ''}`}
                    onClick={showDiagnosis ? () => setExpandedKey(expanded ? null : row.property_id) : undefined}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      {showDiagnosis && (
                        expanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <Link
                        href={`/propiedades/${row.property_id}/reportes`}
                        className="inline-flex items-center gap-1 text-[#ff007c] hover:underline font-medium"
                        onClick={e => e.stopPropagation()}
                      >
                        {row.address}
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </Link>
                      {hasReports ? (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {row.reports_count} reporte{row.reports_count !== 1 ? 's' : ''} · {row.avg_in_person_visits_per_week} vis pres/sem
                        </p>
                      ) : (
                        <p className="text-[10px] text-amber-600 mt-0.5 font-medium inline-flex items-center gap-1">
                          <FileBarChart className="w-3 h-3" aria-hidden="true" />
                          Sin reportes aún
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 hidden sm:table-cell">{row.neighborhood}</td>
                    <td className="py-2.5 px-2 text-gray-600 hidden md:table-cell">
                      {latestAgo ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Clock className="w-3 h-3 text-gray-400" aria-hidden="true" />
                          {latestAgo}
                          {row.latest_report_period_label && (
                            <span className="text-gray-400"> · {row.latest_report_period_label}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {hasReports ? (
                        <>
                          <span className="font-semibold text-gray-800">{row.avg_views_per_day}</span>
                          <span className="text-[10px] text-gray-400 ml-0.5">vis/día</span>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-500 hidden lg:table-cell">
                      {row.neighborhood_sold_avg_views_per_day !== null
                        ? `${row.neighborhood_sold_avg_views_per_day} vis/día`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {hasReports
                        ? <DeltaTag pct={row.delta_vs_neighborhood_pct} status={row.delta_health_status} />
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="py-2.5 pr-4 pl-2 text-right">
                      <Link
                        href={`/propiedades/${row.property_id}/reportes/nuevo`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white text-xs font-medium shadow-sm hover:opacity-90 transition-opacity"
                        title="Crear nuevo reporte"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span className="hidden md:inline">Nuevo</span>
                      </Link>
                    </td>
                  </tr>
                  {expanded && showDiagnosis && row.neighborhood_sold_avg_views_per_day !== null && row.delta_vs_neighborhood_pct !== null && (
                    <tr>
                      <td colSpan={8} className="px-4 pb-4 pt-1">
                        <DiagnosisCard
                          neighborhood={row.neighborhood}
                          deltaPct={row.delta_vs_neighborhood_pct}
                          activeViewsPerDay={row.avg_views_per_day}
                          soldViewsPerDay={row.neighborhood_sold_avg_views_per_day}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
