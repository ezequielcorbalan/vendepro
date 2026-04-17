'use client'

import { useState, useEffect } from 'react'
import { Eye, Home, Handshake, FileBarChart, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import HealthBadge from '@/components/reports/HealthBadge'
import NeighborhoodBenchmarkTable, { type NeighborhoodComparison } from '@/components/reports/NeighborhoodBenchmarkTable'
import ActiveListingsTable, { type ActiveListingWithBenchmark } from '@/components/reports/ActiveListingsTable'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'

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
    avg_views_per_day: number
    avg_in_person_visits_per_week: number
    overall_health_status: HealthStatus
  }
  benchmarks?: {
    caba: { min_views_per_day: number; min_in_person_visits_per_week: number }
    gba:  { min_views_per_day: number; min_in_person_visits_per_week: number }
    source: string
  }
  comparison_by_neighborhood?: NeighborhoodComparison[]
  active_listings?: ActiveListingWithBenchmark[]
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

interface KPICardProps {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  gradient: string
  iconBg: string
  iconColor: string
}

function KPICard({ icon, label, value, sublabel, gradient, iconBg, iconColor }: KPICardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm bg-gradient-to-br ${gradient}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 shadow-sm ${iconBg}`} aria-hidden="true">
        <span className={iconColor}>{icon}</span>
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
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [period])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <p className="text-red-700 font-medium">Error al cargar los datos</p>
        <button
          onClick={() => setPeriod(p => p)}
          className="mt-3 text-sm text-red-600 underline hover:text-red-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const k = data.kpis
  const hasData = k.reports_published > 0
  const overallCfg = HEALTH_COLORS[k.overall_health_status]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 shadow-inner">
          {([
            ['week', 'Sem'],
            ['month', 'Mes'],
            ['quarter', 'Trim'],
            ['year', 'Año'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                period === key
                  ? 'bg-white shadow-sm text-gray-800'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Benchmark comparativo activos vs vendidos — tabla por barrio */}
      {data.comparison_by_neighborhood && data.comparison_by_neighborhood.length > 0 && (
        <NeighborhoodBenchmarkTable data={data.comparison_by_neighborhood} />
      )}

      {/* Mis avisos activos — detalle por propiedad */}
      {data.active_listings && data.active_listings.length > 0 && (
        <ActiveListingsTable data={data.active_listings} />
      )}

      {/* Leyenda del semáforo — referencia MG */}
      <div className="rounded-xl border border-gray-200 p-3 sm:p-4 text-xs sm:text-sm bg-gradient-to-br from-gray-50 to-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <span className="font-medium text-gray-700">Referencia MG — visualizaciones/día:</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" /> 0–9</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" /> 10–13</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm" /> 14–22</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-lime-500 shadow-sm" /> 23–27</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> +28</span>
        </div>
        <p className="text-gray-500 leading-snug">
          <strong>Mínimo para vender en 4 meses:</strong>{' '}
          CABA <strong>14 vis/día</strong> + 1.5 visitas pres./sem ·{' '}
          GBA <strong>8 vis/día</strong> + 1 visita pres./sem.
        </p>
      </div>

      {!hasData && (
        <div className="rounded-2xl border border-gray-200 p-8 text-center bg-gradient-to-br from-gray-50 to-white shadow-sm">
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
            {/* KPI destacado: visualizaciones/día con color del semáforo */}
            <div className={`rounded-xl border-2 p-3 sm:p-4 shadow-sm bg-gradient-to-br ${overallCfg.border} ${overallCfg.bg}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-white/70 border ${overallCfg.border} shadow-sm`} aria-hidden="true">
                <Eye className={`w-5 h-5 ${overallCfg.text}`} />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${overallCfg.text}`}>
                {k.avg_views_per_day}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Visualizaciones/día ∅</p>
              <div className="mt-1">
                <HealthBadge status={k.overall_health_status} size="sm" withLabel />
              </div>
            </div>

            <KPICard
              icon={<FileBarChart className="w-5 h-5" />}
              label="Reportes publicados"
              value={String(k.reports_published)}
              gradient="from-white to-pink-50"
              iconBg="bg-pink-100"
              iconColor="text-pink-600"
            />
            <KPICard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Visitas al portal ∅"
              value={String(k.avg_portal_visits_per_report)}
              sublabel={`${formatNumber(k.total_portal_visits)} total`}
              gradient="from-white to-blue-50"
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <KPICard
              icon={<Handshake className="w-5 h-5" />}
              label="Ofertas"
              value={String(k.total_offers)}
              sublabel={`${k.avg_offers_per_report} por aviso`}
              gradient="from-white to-green-50"
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
          </div>

          <div className="rounded-xl border border-gray-200 p-3 sm:p-4 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 bg-gradient-to-r from-white via-white to-gray-50/50 shadow-sm">
            <span className="inline-flex items-center gap-1">
              <Home className="w-3 h-3" aria-hidden="true" />
              Visitas presenciales:{' '}
              <strong className="text-gray-700">{k.avg_in_person_visits_per_week}</strong>/semana ∅
              <span className="text-gray-400">({k.total_in_person_visits} total · {k.avg_in_person_visits_per_report} por aviso)</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="w-3 h-3" aria-hidden="true" />
              Impresiones totales (exposición):{' '}
              <strong className="text-gray-700">{formatNumber(k.total_impressions)}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
