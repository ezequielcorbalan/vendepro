import { getPublicReport } from '@/lib/actions'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import EvolutionChart from '@/components/public-report/EvolutionChart'
import Link from 'next/link'
import type { ReportMetric, HistoricalDataPoint } from '@/lib/types'

export default async function HistorialPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getPublicReport(slug)

  if (!data) notFound()

  const property = data.property as any
  const allReports = data.reports as any[]

  if (allReports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Sin reportes</h1>
          <p className="text-brand-gray">No hay reportes publicados para esta propiedad.</p>
        </div>
      </div>
    )
  }

  const historicalData: HistoricalDataPoint[] = allReports.map((r: any) => {
    const rMetrics = (r.metrics || []) as ReportMetric[]
    return {
      period: r.period_label,
      impressions: rMetrics.reduce((a: number, m: ReportMetric) => a + (m.impressions || 0), 0),
      portal_visits: rMetrics.reduce((a: number, m: ReportMetric) => a + (m.portal_visits || 0), 0),
      inquiries: rMetrics.reduce((a: number, m: ReportMetric) => a + (m.inquiries || 0), 0),
      in_person_visits: rMetrics.reduce((a: number, m: ReportMetric) => a + (m.in_person_visits || 0), 0),
      offers: rMetrics.reduce((a: number, m: ReportMetric) => a + (m.offers || 0), 0),
    }
  })

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.png" alt="Marcela Genta" className="h-10 brightness-0 invert" />
            <span className="text-white/80 text-sm font-medium">Operaciones Inmobiliarias</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{property.address}</h1>
          <p className="text-white/80">Historial completo &middot; {allReports.length} reportes</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {historicalData.length > 1 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
              Evolución de métricas
            </h2>
            <EvolutionChart data={historicalData} />
          </section>
        )}

        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-pink rounded-full"></span>
            Todos los reportes
          </h2>
          <div className="space-y-3">
            {allReports.map((report: any) => {
              const rMetrics = (report.metrics || []) as ReportMetric[]
              const totalInquiries = rMetrics.reduce((a: number, m: ReportMetric) => a + (m.inquiries || 0), 0)
              const totalVisits = rMetrics.reduce((a: number, m: ReportMetric) => a + (m.portal_visits || 0), 0)
              const totalImpressions = rMetrics.reduce((a: number, m: ReportMetric) => a + (m.impressions || 0), 0)

              return (
                <div key={report.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">{report.period_label}</h3>
                    <span className="text-sm text-brand-gray">
                      {formatDate(report.period_start)} - {formatDate(report.period_end)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-indigo-500">{totalImpressions.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-brand-gray">Impresiones</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-brand-pink">{totalVisits.toLocaleString('es-AR')}</p>
                      <p className="text-xs text-brand-gray">Visitas</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-brand-orange">{totalInquiries}</p>
                      <p className="text-xs text-brand-gray">Consultas</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="text-center pt-4 pb-8">
          <Link href={`/r/${slug}`} className="text-brand-pink font-medium hover:underline">
            Volver al reporte actual
          </Link>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <img src="/logo.png" alt="Marcela Genta" className="h-8 mx-auto mb-3 brightness-0 invert" />
          <p className="text-gray-400 text-sm">Marcela Genta &middot; Operaciones Inmobiliarias</p>
        </div>
      </footer>
    </div>
  )
}
