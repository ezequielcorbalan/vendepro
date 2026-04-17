'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Scale } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import type { HealthStatus } from '@/lib/semaforo'

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

interface Props {
  data: NeighborhoodComparison[]
}

function DeltaCell({ pct, status }: { pct: number | null; status: HealthStatus }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
        <HealthBadge status={status} size="sm" />
        Sin benchmark
      </span>
    )
  }
  const prefix = pct >= 0 ? '+' : ''
  const colorClass = pct < -30
    ? 'text-red-600'
    : pct < -10
      ? 'text-yellow-700'
      : pct < 0
        ? 'text-lime-700'
        : 'text-green-700'
  return (
    <span className="inline-flex items-center gap-2">
      <HealthBadge status={status} size="sm" />
      <span className={`font-semibold ${colorClass}`}>{prefix}{pct.toFixed(0)}%</span>
    </span>
  )
}

export default function NeighborhoodBenchmarkTable({ data }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const hasAnyData = data.some(d => d.active !== null)
  if (!hasAnyData) return null

  return (
    <div className="bg-white rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Scale className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
        <h2 className="font-semibold text-gray-800">Tus activos vs vendidos</h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Benchmark interno por barrio — ¿cómo vienen tus avisos contra los que se vendieron?
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-2 w-8"></th>
              <th className="pb-2 pr-4">Barrio</th>
              <th className="pb-2 px-2 text-right">Activos ∅</th>
              <th className="pb-2 px-2 text-right">Vendidos ∅</th>
              <th className="pb-2 px-2 text-right hidden sm:table-cell">Vis. pres./sem activos</th>
              <th className="pb-2 px-2 text-right hidden md:table-cell">Vis. pres./sem vendidos</th>
              <th className="pb-2 pl-2 text-right">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => {
              const expanded = expandedKey === row.neighborhood
              const showDiagnosis = row.delta_views_per_day_pct !== null
                && row.delta_views_per_day_pct < -10
                && row.active !== null
                && row.sold !== null
              return (
                <Fragment key={row.neighborhood}>
                  <tr
                    className={`hover:bg-gray-50 ${showDiagnosis ? 'cursor-pointer' : ''}`}
                    onClick={showDiagnosis ? () => setExpandedKey(expanded ? null : row.neighborhood) : undefined}
                  >
                    <td className="py-2 pr-2">
                      {showDiagnosis && (
                        expanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      )}
                    </td>
                    <td className="py-2 pr-4 font-medium text-gray-800">
                      {row.neighborhood}
                      {row.active && (
                        <span className="text-[10px] text-gray-400 font-normal ml-1">
                          ({row.active.reports_count} reporte{row.active.reports_count !== 1 ? 's' : ''})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {row.active ? `${row.active.avg_views_per_day}` : '—'}
                      {row.active && <span className="text-[10px] text-gray-400 ml-0.5">vis/día</span>}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">
                      {row.sold ? `${row.sold.avg_views_per_day}` : '—'}
                      {row.sold && <span className="text-[10px] text-gray-400 ml-0.5">vis/día</span>}
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
                  {expanded && showDiagnosis && row.active && row.sold && row.delta_views_per_day_pct !== null && (
                    <tr>
                      <td colSpan={7} className="px-2 pb-3">
                        <DiagnosisCard
                          neighborhood={row.neighborhood}
                          deltaPct={row.delta_views_per_day_pct}
                          activeViewsPerDay={row.active.avg_views_per_day}
                          soldViewsPerDay={row.sold.avg_views_per_day}
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
