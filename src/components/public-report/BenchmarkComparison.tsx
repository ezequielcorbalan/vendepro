'use client'

interface Props {
  currentImpressions: number
  currentVisits: number
  currentInquiries: number
  benchmark: {
    avg_impressions: number
    avg_visits: number
    avg_inquiries: number
    sold_count: number
  }
  neighborhood: string
}

function getPercentage(current: number, avg: number): number {
  if (avg === 0) return 0
  return Math.round((current / avg) * 100)
}

function getStatusColor(pct: number): string {
  if (pct >= 80) return 'text-green-600'
  if (pct >= 50) return 'text-yellow-600'
  return 'text-red-500'
}

function getStatusBg(pct: number): string {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-400'
}

function getStatusLabel(pct: number): string {
  if (pct >= 100) return 'Por encima del promedio de vendidas'
  if (pct >= 80) return 'Cerca del promedio de vendidas'
  if (pct >= 50) return 'Por debajo del promedio'
  return 'Muy por debajo del promedio'
}

export default function BenchmarkComparison({
  currentImpressions,
  currentVisits,
  currentInquiries,
  benchmark,
  neighborhood,
}: Props) {
  const metrics = [
    {
      label: 'Impresiones',
      current: currentImpressions,
      avg: benchmark.avg_impressions,
      pct: getPercentage(currentImpressions, benchmark.avg_impressions),
    },
    {
      label: 'Visitas al aviso',
      current: currentVisits,
      avg: benchmark.avg_visits,
      pct: getPercentage(currentVisits, benchmark.avg_visits),
    },
    {
      label: 'Consultas',
      current: currentInquiries,
      avg: benchmark.avg_inquiries,
      pct: getPercentage(currentInquiries, benchmark.avg_inquiries),
    },
  ]

  const overallPct = Math.round(
    metrics.reduce((sum, m) => sum + m.pct, 0) / metrics.length
  )

  return (
    <section className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
        Comparación con propiedades vendidas
      </h2>
      <p className="text-xs text-gray-500 mb-4 ml-3">
        Basado en {benchmark.sold_count} propiedad{benchmark.sold_count !== 1 ? 'es' : ''} vendida{benchmark.sold_count !== 1 ? 's' : ''} en {neighborhood}
      </p>

      {/* Overall indicator */}
      <div className="bg-white rounded-xl p-4 mb-4 flex items-center gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
          overallPct >= 80 ? 'bg-green-100' : overallPct >= 50 ? 'bg-yellow-100' : 'bg-red-100'
        }`}>
          <span className={`text-xl font-bold ${getStatusColor(overallPct)}`}>
            {overallPct}%
          </span>
        </div>
        <div>
          <p className={`font-semibold ${getStatusColor(overallPct)}`}>
            {getStatusLabel(overallPct)}
          </p>
          <p className="text-xs text-gray-500">
            Comparando métricas actuales con el promedio de propiedades que se vendieron
          </p>
        </div>
      </div>

      {/* Individual metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">{m.label}</p>
            <div className="flex items-end justify-between mb-2">
              <span className="text-lg font-bold text-gray-800">{m.current.toLocaleString('es-AR')}</span>
              <span className="text-xs text-gray-400">prom. {m.avg.toLocaleString('es-AR')}</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getStatusBg(m.pct)}`}
                style={{ width: `${Math.min(m.pct, 100)}%` }}
              ></div>
            </div>
            <p className={`text-xs font-medium mt-1 ${getStatusColor(m.pct)}`}>
              {m.pct}% del promedio de vendidas
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
