import { getPublicReport, getPriceHistory } from '@/lib/actions'
import { getDB } from '@/lib/db'
import { getSoldBenchmarks } from '@/lib/benchmarks'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import FunnelChart from '@/components/public-report/FunnelChart'
import EvolutionChart from '@/components/public-report/EvolutionChart'
import PortalPieChart from '@/components/public-report/PortalPieChart'
import { MetricsGridFromTotals } from '@/components/public-report/MetricsGrid'
import ReportSelector from '@/components/public-report/ReportSelector'
import BenchmarkComparison from '@/components/public-report/BenchmarkComparison'
import PhotoGallery from '@/components/public-report/PhotoGallery'
import PriceEvolution from '@/components/public-report/PriceEvolution'
import Link from 'next/link'
import type { ReportMetric, ReportContent, ReportPhoto, HistoricalDataPoint, FunnelData } from '@/lib/types'

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reporte?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const data = await getPublicReport(slug)

  if (!data) notFound()

  const property = data.property as any
  const allReports = data.reports as any[]
  const competitors = (data.competitors || []) as any[]

  if (allReports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">Sin reportes publicados</h1>
          <p className="text-gray-500">Todavía no hay reportes disponibles para esta propiedad.</p>
        </div>
      </div>
    )
  }

  // Select report by query param or default to latest
  const reportIndex = sp.reporte !== undefined
    ? Math.min(Math.max(0, parseInt(sp.reporte) || 0), allReports.length - 1)
    : allReports.length - 1

  const report = allReports[reportIndex] as any
  const metrics = (report.metrics || []) as ReportMetric[]
  const contentSections = (report.content || []) as ReportContent[]
  const photos = (report.photos || []) as ReportPhoto[]

  // Fetch visit forms for this property
  let visitForms: any[] = []
  try {
    const db = await getDB()
    visitForms = (await db.prepare(
      "SELECT visitor_name, rating, likes, dislikes, would_buy, price_opinion, how_found, created_at FROM visit_forms WHERE property_id = ? ORDER BY created_at DESC"
    ).bind(property.id).all()).results as any[]
  } catch { /* table may not exist */ }

  const totalMetrics = metrics.reduce(
    (acc, m) => ({
      impressions: acc.impressions + (m.impressions || 0),
      portal_visits: acc.portal_visits + (m.portal_visits || 0),
      inquiries: acc.inquiries + (m.inquiries || 0),
      in_person_visits: acc.in_person_visits + (m.in_person_visits || 0),
      offers: acc.offers + (m.offers || 0),
    }),
    { impressions: 0, portal_visits: 0, inquiries: 0, in_person_visits: 0, offers: 0 }
  )

  // Get benchmark and price history
  const benchmark = await getSoldBenchmarks(property.neighborhood as string)
  const priceHistory = await getPriceHistory(property.id as string) as any[]

  const funnelData: FunnelData[] = [
    { label: 'Impresiones', value: totalMetrics.impressions, color: '#6366f1' },
    { label: 'Visitas portal', value: totalMetrics.portal_visits, color: '#ff007c' },
    { label: 'Consultas', value: totalMetrics.inquiries, color: '#ff8017' },
    { label: 'Visitas presenc.', value: totalMetrics.in_person_visits, color: '#10b981' },
    { label: 'Ofertas', value: totalMetrics.offers, color: '#f59e0b' },
  ]

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

  const getSection = (section: string) =>
    contentSections.find((c) => c.section === section)

  const strategy = getSection('strategy')
  const marketing = getSection('marketing')
  const conclusion = getSection('conclusion')
  const priceRef = getSection('price_reference')

  const portalNames: Record<string, string> = {
    zonaprop: 'ZonaProp',
    argenprop: 'Argenprop',
    mercadolibre: 'MercadoLibre',
    manual: 'Otros',
  }

  const reportOptions = allReports.map((r: any) => ({ id: r.id, period_label: r.period_label }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Marcela Genta" className="h-8 sm:h-10 brightness-0 invert" />
            <span className="text-white/80 text-xs sm:text-sm font-medium">Operaciones Inmobiliarias</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1">{property.address}</h1>
          <p className="text-white/80 text-sm sm:text-base">
            {property.neighborhood}, {property.city} · {property.property_type}
            {property.rooms ? ` · ${property.rooms} amb.` : ''}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ReportSelector reports={reportOptions} currentIndex={reportIndex} slug={slug} />
            <span className="text-white/60 text-xs sm:text-sm">
              {formatDate(report.period_start)} - {formatDate(report.period_end)}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Key Metrics Grid */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-[#ff007c] rounded-full"></span>
            Métricas clave del período
          </h2>
          <MetricsGridFromTotals totals={{
            ...totalMetrics,
            phone_calls: metrics.reduce((a, m) => a + (m.phone_calls || 0), 0),
            whatsapp: metrics.reduce((a, m) => a + (m.whatsapp || 0), 0),
            ranking_position: metrics.find(m => m.ranking_position)?.ranking_position,
          }} />
        </section>

        {/* Funnel */}
        <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
            Embudo de conversión
          </h2>
          <FunnelChart data={funnelData} />
        </section>

        {/* Benchmark Comparison */}
        {benchmark && (
          <BenchmarkComparison
            currentImpressions={totalMetrics.impressions}
            currentVisits={totalMetrics.portal_visits}
            currentInquiries={totalMetrics.inquiries}
            benchmark={benchmark}
            neighborhood={property.neighborhood as string}
          />
        )}

        {/* Per-portal pie charts */}
        {metrics.length > 1 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#ff8017] rounded-full"></span>
              Distribución por portal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <PortalPieChart metrics={metrics} dataKey="inquiries" title="Consultas" />
              <PortalPieChart metrics={metrics} dataKey="portal_visits" title="Visitas al aviso" />
              <PortalPieChart metrics={metrics} dataKey="impressions" title="Impresiones" />
            </div>
          </section>
        )}

        {/* Ranking */}
        {metrics.some(m => m.ranking_position) && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full"></span>
              Ranking en portales
            </h2>
            <div className="flex flex-wrap gap-4">
              {metrics.filter(m => m.ranking_position).map((m) => (
                <div key={m.id} className="bg-gray-50 rounded-xl p-5 sm:p-6 text-center flex-1 min-w-[120px]">
                  <p className="text-sm text-gray-500">{portalNames[m.source]}</p>
                  <p className="text-3xl sm:text-4xl font-bold text-[#ff007c]">#{m.ranking_position}</p>
                  <p className="text-xs text-gray-400 mt-1">posición en la zona</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Evolution Chart */}
        {historicalData.length > 1 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
              Evolución de métricas
            </h2>
            <EvolutionChart data={historicalData} />
          </section>
        )}

        {/* Content sections */}
        {/* Price Evolution */}
        {priceHistory.length > 0 && (
          <PriceEvolution
            history={priceHistory}
            currentPrice={Number(property.asking_price) || 0}
            currency={(property.currency as string) || 'USD'}
          />
        )}

        {strategy && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#ff007c] rounded-full"></span>
              {strategy.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{strategy.body}</p>
          </section>
        )}

        {marketing && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#ff8017] rounded-full"></span>
              {marketing.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{marketing.body}</p>
          </section>
        )}

        {priceRef && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-yellow-500 rounded-full"></span>
              {priceRef.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{priceRef.body}</p>
          </section>
        )}

        {conclusion && (
          <section className="bg-gradient-to-br from-[#ff007c]/5 to-[#ff8017]/5 border border-[#ff007c]/15 rounded-2xl p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full"></span>
              {conclusion.title}
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{conclusion.body}</p>
          </section>
        )}

        {/* Competitors */}
        {competitors.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-red-400 rounded-full"></span>
              Propiedades similares en la zona
            </h2>
            <div className="space-y-3">
              {competitors.map((comp: any) => (
                <div key={comp.id} className="border border-gray-100 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    {comp.address && (
                      <p className="font-medium text-gray-800 text-sm truncate">{comp.address}</p>
                    )}
                    {comp.price && (
                      <p className="text-sm text-brand-pink font-semibold">
                        {comp.currency || 'USD'} {Number(comp.price).toLocaleString('es-AR')}
                      </p>
                    )}
                    {comp.notes && (
                      <p className="text-xs text-gray-500 mt-1">{comp.notes}</p>
                    )}
                  </div>
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline flex-shrink-0 bg-indigo-50 px-3 py-1.5 rounded-lg"
                  >
                    Ver aviso ↗
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photos */}
        {photos.length > 0 && <PhotoGallery photos={photos} />}

        {/* Visit Forms Summary */}
        {visitForms.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Feedback de visitantes</h2>
              <p className="text-xs text-gray-400 mt-1">{visitForms.length} ficha{visitForms.length !== 1 ? 's' : ''} de visita</p>
            </div>
            <div className="p-5 sm:p-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-black text-gray-800">{visitForms.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Visitas</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-2xl font-black text-green-600">{visitForms.filter((f: any) => f.would_buy).length}</p>
                  <p className="text-[10px] text-gray-400 uppercase">Interesados</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-xl">
                  <p className="text-2xl font-black text-yellow-600">
                    {visitForms.filter((f: any) => f.rating).length > 0
                      ? (visitForms.reduce((s: number, f: any) => s + (f.rating || 0), 0) / visitForms.filter((f: any) => f.rating).length).toFixed(1)
                      : '-'}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase">Rating prom.</p>
                </div>
              </div>

              {/* Individual feedback */}
              <div className="space-y-3">
                {visitForms.slice(0, 5).map((f: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{f.visitor_name}</span>
                      <div className="flex items-center gap-0.5">
                        {f.rating && [1,2,3,4,5].map((n: number) => (
                          <span key={n} className={`text-xs ${n <= f.rating ? 'text-yellow-500' : 'text-gray-200'}`}>&#9733;</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.would_buy !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${f.would_buy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {f.would_buy ? 'Comprar\u00eda' : 'No comprar\u00eda'}
                        </span>
                      )}
                      {f.price_opinion && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {f.price_opinion === 'justo' ? 'Precio justo' : f.price_opinion === 'buen_precio' ? 'Buen precio' : f.price_opinion === 'algo_caro' ? 'Algo caro' : f.price_opinion === 'muy_caro' ? 'Muy caro' : f.price_opinion === 'oportunidad' ? 'Oportunidad' : f.price_opinion}
                        </span>
                      )}
                    </div>
                    {f.likes && <p className="text-xs text-green-600 mt-1">&ldquo;{f.likes}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Historical link */}
        {allReports.length > 1 && (
          <div className="text-center">
            <Link
              href={`/r/${slug}/historial`}
              className="text-[#ff007c] font-medium hover:underline text-sm sm:text-base"
            >
              Ver historial completo ({allReports.length} reportes)
            </Link>
          </div>
        )}

        {/* WhatsApp share */}
        <div className="text-center pb-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Mirá el reporte de ${property.address}`)}`}
            target="_blank"
            className="inline-flex items-center gap-2 bg-green-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-medium hover:bg-green-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Compartir por WhatsApp
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <img src="/logo.png" alt="Marcela Genta" className="h-8 mx-auto mb-3 brightness-0 invert" />
          <p className="text-gray-400 text-sm">Marcela Genta · Operaciones Inmobiliarias</p>
          {property.agent_name && (
            <p className="text-gray-500 text-xs mt-1">Agente: {property.agent_name}</p>
          )}
        </div>
      </footer>
    </div>
  )
}
