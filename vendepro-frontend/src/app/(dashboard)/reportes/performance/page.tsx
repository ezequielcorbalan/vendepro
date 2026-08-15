'use client'

import { useState, useEffect } from 'react'
import { Eye, Home, Handshake, FileBarChart, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import HealthBadge from '@/components/reports/HealthBadge'
import NeighborhoodBenchmarkTable, { type NeighborhoodComparison } from '@/components/reports/NeighborhoodBenchmarkTable'
import ActiveListingsTable, { type ActiveListingWithBenchmark } from '@/components/reports/ActiveListingsTable'
import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatTile } from '@/components/ui/StatTile'
import { Text } from '@/components/ui/Typography'

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

const PROPERTY_TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'local', label: 'Local comercial' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
] as const

const PERIOD_OPTIONS = [
  { value: 'week', label: 'Sem' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trim' },
  { value: 'year', label: 'Año' },
]

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [propertyType, setPropertyType] = useState<string>('')
  const [priceMin, setPriceMin] = useState<string>('')
  const [priceMax, setPriceMax] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ period })
    if (propertyType) params.set('property_type', propertyType)
    if (priceMin) params.set('price_min', priceMin)
    if (priceMax) params.set('price_max', priceMax)
    apiFetch('analytics', `/listings-performance?${params.toString()}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<any>
      })
      .then(d => {
        if (!d?.kpis) throw new Error('respuesta sin kpis')
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [period, propertyType, priceMin, priceMax])

  const hasFilters = propertyType !== '' || priceMin !== '' || priceMax !== ''
  const clearFilters = () => { setPropertyType(''); setPriceMin(''); setPriceMax('') }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-card" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-card" />
        <div className="h-64 bg-gray-200 rounded-card" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Alert tone="danger" title="Error al cargar los datos">
        <Button variant="ghost" onClick={() => setPeriod(p => p)} className="mt-2">
          Reintentar
        </Button>
      </Alert>
    )
  }

  const k = data.kpis
  const hasData = k.reports_published > 0
  const overallCfg = HEALTH_COLORS[k.overall_health_status]

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Búsqueda + filtros: una sola fila compacta (sin labels ni card propio) */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Tipo de propiedad"
          value={propertyType}
          onChange={e => setPropertyType(e.target.value)}
          className="w-auto"
        >
          {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <div className="flex items-center gap-1 text-sm text-gray-500">USD</div>
        <Input
          aria-label="Precio desde"
          type="number"
          value={priceMin}
          onChange={e => setPriceMin(e.target.value)}
          placeholder="Desde"
          className="w-24"
        />
        <Input
          aria-label="Precio hasta"
          type="number"
          value={priceMax}
          onChange={e => setPriceMax(e.target.value)}
          placeholder="Hasta"
          className="w-24"
        />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-primary shrink-0">
            Limpiar
          </button>
        )}
        <div className="flex-1" />
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={v => setPeriod(v as Period)}
        />
      </div>

      {!hasData && (
        <Card padded={false}>
          <EmptyState
            icon={<FileBarChart className="w-6 h-6" />}
            title="Todavía no hay reportes publicados en este período"
            description="Probá un rango más amplio, o publicá el primer reporte desde una propiedad."
          />
        </Card>
      )}

      {hasData && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI destacado: visualizaciones/día con color del semáforo.
                ds-todo: candidato a variante de StatTile con borde de color + slot de badge
                (HealthBadge abajo) — StatTile hoy no soporta ninguna de las dos cosas. */}
            <Card className={`border-2 p-3 sm:p-4 bg-gradient-to-br ${overallCfg.border} ${overallCfg.bg}`}>
              <div className={`w-9 h-9 rounded-control flex items-center justify-center mb-2 bg-white/70 border ${overallCfg.border} shadow-card`} aria-hidden="true">
                <Eye className={`w-5 h-5 ${overallCfg.text}`} />
              </div>
              <Text weight="bold" className={`text-xl sm:text-2xl ${overallCfg.text}`}>
                {k.avg_views_per_day}
              </Text>
              <Text size="xs" className="text-gray-600 mt-0.5">Visualizaciones/día ∅</Text>
              <div className="mt-1">
                <HealthBadge status={k.overall_health_status} size="sm" withLabel />
              </div>
            </Card>

            <StatTile
              icon={<FileBarChart className="w-5 h-5" />}
              label="Reportes publicados"
              value={String(k.reports_published)}
              tone="bg-pink-50 text-pink-600"
            />
            <StatTile
              icon={<TrendingUp className="w-5 h-5" />}
              label="Visitas al portal ∅"
              value={String(k.avg_portal_visits_per_report)}
              caption={`${formatNumber(k.total_portal_visits)} total`}
              tone="bg-blue-50 text-blue-600"
            />
            <StatTile
              icon={<Handshake className="w-5 h-5" />}
              label="Ofertas"
              value={String(k.total_offers)}
              caption={`${k.avg_offers_per_report} por aviso`}
              tone="bg-green-50 text-green-600"
            />
          </div>

          <Card className="p-3 sm:p-4 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 bg-gradient-to-r from-white via-white to-gray-50/50">
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
          </Card>
        </>
      )}

      {/* Benchmark comparativo activos vs vendidos — tabla por barrio */}
      {data.comparison_by_neighborhood && data.comparison_by_neighborhood.length > 0 && (
        <NeighborhoodBenchmarkTable data={data.comparison_by_neighborhood} />
      )}

      {/* Mis avisos activos — detalle por propiedad */}
      {data.active_listings && data.active_listings.length > 0 && (
        <ActiveListingsTable data={data.active_listings} />
      )}

      {/* Leyenda del semáforo — referencia MG */}
      <Card className="p-3 sm:p-4 text-xs sm:text-sm bg-gradient-to-br from-gray-50 to-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
          <span className="font-medium text-gray-700">Referencia MG — visualizaciones/día:</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> 0–9</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> 10–13</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> 14–22</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-lime-500" /> 23–27</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> +28</span>
        </div>
        <Text tone="muted" className="text-xs sm:text-sm leading-snug">
          <strong>Mínimo para vender en 4 meses:</strong>{' '}
          CABA <strong>14 vis/día</strong> + 1.5 visitas pres./sem ·{' '}
          GBA <strong>8 vis/día</strong> + 1 visita pres./sem.
        </Text>
      </Card>
    </div>
  )
}
