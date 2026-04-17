'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, Scale, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import HealthBadge from './HealthBadge'
import DiagnosisCard from './DiagnosisCard'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'

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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.border} shadow-sm`}>
      <Icon className={`w-3 h-3 ${cfg.text}`} aria-hidden="true" />
      <span className={`font-semibold text-xs ${cfg.text}`}>{prefix}{pct.toFixed(0)}%</span>
    </span>
  )
}

export default function NeighborhoodBenchmarkTable({ data }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const hasAnyData = data.some(d => d.active !== null)
  if (!hasAnyData) return null

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-gradient-to-br from-white via-white to-orange-50/20">
      <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-white to-orange-50/30 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff8017] to-[#ff007c] flex items-center justify-center shadow-sm" aria-hidden="true">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-semibold text-gray-800">Tus activos vs vendidos — resumen por barrio</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          ¿Cómo vienen tus avisos contra los que se vendieron? (promedio por barrio)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-500 bg-gray-50/50 border-b border-gray-100">
              <th className="py-2.5 pl-4 pr-2 w-8"></th>
              <th className="py-2.5 px-2">Barrio</th>
              <th className="py-2.5 px-2 text-right">Activos ∅</th>
              <th className="py-2.5 px-2 text-right">Vendidos ∅</th>
              <th className="py-2.5 px-2 text-right hidden sm:table-cell">Vis. pres./sem</th>
              <th className="py-2.5 pr-4 pl-2 text-right">Diagnóstico</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map(row => {
              const expanded = expandedKey === row.neighborhood
              const showDiagnosis = row.delta_views_per_day_pct !== null
                && row.delta_views_per_day_pct < -10
                && row.active !== null
                && row.sold !== null
              const activePropCount = row.active?.property_count ?? 0
              const soldPropCount = row.sold?.property_count ?? 0
              return (
                <Fragment key={row.neighborhood}>
                  <tr
                    className={`hover:bg-orange-50/20 transition-colors ${showDiagnosis ? 'cursor-pointer' : ''}`}
                    onClick={showDiagnosis ? () => setExpandedKey(expanded ? null : row.neighborhood) : undefined}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      {showDiagnosis && (
                        expanded
                          ? <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          : <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <p className="font-medium text-gray-800">{row.neighborhood}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {activePropCount > 0 && (
                          <>
                            {activePropCount} activa{activePropCount !== 1 ? 's' : ''}
                          </>
                        )}
                        {activePropCount > 0 && soldPropCount > 0 && ' · '}
                        {soldPropCount > 0 && (
                          <>
                            {soldPropCount} vendida{soldPropCount !== 1 ? 's' : ''}
                          </>
                        )}
                      </p>
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {row.active ? (
                        <>
                          <span className="font-semibold text-gray-800">{row.active.avg_views_per_day}</span>
                          <span className="text-[10px] text-gray-400 ml-0.5">vis/día</span>
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {row.sold ? (
                        <>
                          <span className="font-semibold text-gray-800">{row.sold.avg_views_per_day}</span>
                          <span className="text-[10px] text-gray-400 ml-0.5">vis/día</span>
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-600 hidden sm:table-cell">
                      {row.active ? (
                        <>
                          <span>{row.active.avg_in_person_visits_per_week}</span>
                          {row.sold && <span className="text-gray-400"> / {row.sold.avg_in_person_visits_per_week}</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 pl-2 text-right">
                      <DeltaCell pct={row.delta_views_per_day_pct} status={row.delta_health_status} />
                    </td>
                  </tr>
                  {expanded && showDiagnosis && row.active && row.sold && row.delta_views_per_day_pct !== null && (
                    <tr>
                      <td colSpan={6} className="px-4 pb-4 pt-1">
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
