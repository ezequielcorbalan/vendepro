import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  Eye,
  MousePointerClick,
  MessageSquare,
  Home,
  HandCoins,
  Trophy,
  Star,
  ThumbsUp,
  ThumbsDown,
  User,
} from 'lucide-react'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'https://public.api.vendepro.com.ar'

const SECTION_TITLES: Record<string, string> = {
  strategy: 'Estrategia comercial',
  marketing: 'Marketing y difusión',
  conclusion: 'Conclusión y recomendación',
  price_reference: 'Referencia de precio',
}

const SOURCE_LABEL: Record<string, string> = {
  argenprop: 'Argenprop',
  mercadolibre: 'Mercado Libre',
  zonaprop: 'Zonaprop',
  instagram: 'Instagram',
  recomendacion: 'Recomendación',
  otro: 'Otros',
}

const SITUATION_LABEL: Record<string, string> = {
  mudanza: 'Mudanza',
  primera_vivienda: 'Primera vivienda',
  inversion: 'Inversión',
  downsizing: 'Downsizing',
  otro: 'Otros',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/report/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Reporte de propiedad', robots: { index: false } }
    const data = (await res.json()) as any
    const property = data?.property
    if (!property) return { title: 'Reporte de propiedad', robots: { index: false } }
    return {
      title: `Reporte de gestión — ${property.address}`,
      description: `Métricas de comercialización de ${property.address}.`,
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Reporte de propiedad', robots: { index: false } }
  }
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const res = await fetch(`${API_PUBLIC}/public/report/${slug}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const data = (await res.json()) as any
  if (!data?.property) notFound()

  const {
    property,
    org,
    report,
    metrics = [],
    content = [],
    photos = [],
    visit_forms = [],
    available_reports = [],
    competitors = [],
  } = data
  const brand = org?.brand_color || '#ff007c'

  // Aggregate metrics across sources for the dashboard
  const totals = aggregateMetrics(metrics)
  const ranking = pickRanking(metrics)

  const periodFmt = `${formatDate(report?.period_start)} – ${formatDate(report?.period_end)}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="h-10 w-auto" />
            ) : (
              <div
                className="h-10 px-3 rounded-lg flex items-center text-white font-semibold"
                style={{ backgroundColor: brand }}
              >
                {org?.name ?? 'VendéPro'}
              </div>
            )}
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-ink truncate">{org?.name}</div>
              <div className="text-xs text-gray-500">Operaciones Inmobiliarias</div>
            </div>
          </div>
          <ReportSelector
            current={report}
            available={available_reports}
            periodFmt={periodFmt}
            brand={brand}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Mobile selector (header version is desktop only) */}
        {available_reports.length > 1 && (
          <details className="sm:hidden bg-white rounded-xl border border-gray-100 p-3">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer">
              Ver otros reportes ({available_reports.length - 1})
            </summary>
            <div className="mt-2 space-y-1">
              {available_reports.map((r: any) => (
                <a
                  key={r.slug}
                  href={`/r/${r.slug}`}
                  className={`block px-2 py-1.5 rounded text-sm ${
                    r.is_current
                      ? 'bg-gray-100 text-ink font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r.period_label}
                  {r.is_current && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                      actual
                    </span>
                  )}
                </a>
              ))}
            </div>
          </details>
        )}

        {/* Property hero */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {property.cover_photo && (
            <div className="relative h-56 sm:h-64 w-full bg-gray-100">
              <img
                src={property.cover_photo}
                alt={property.address}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 text-white">
                <h1 className="text-2xl font-bold leading-tight">{property.address}</h1>
                <p className="text-sm opacity-90">
                  {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
          <div className="p-6">
            {!property.cover_photo && (
              <>
                <h1 className="text-2xl font-bold text-ink">{property.address}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {[property.neighborhood, property.city].filter(Boolean).join(' · ')}
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {property.property_type && (
                <Pill label="Tipo" value={cap(property.property_type)} />
              )}
              {property.rooms != null && (
                <Pill label="Ambientes" value={String(property.rooms)} />
              )}
              {property.size_m2 != null && (
                <Pill label="Superficie" value={`${property.size_m2} m²`} />
              )}
              {property.asking_price != null && (
                <Pill
                  label="Precio publicado"
                  value={`${property.currency ?? 'USD'} ${formatNumber(property.asking_price)}`}
                  emphasize
                  color={brand}
                />
              )}
            </div>
          </div>
        </section>

        {/* Metrics dashboard */}
        {(totals.impressions ||
          totals.portal_visits ||
          totals.inquiries ||
          totals.in_person_visits ||
          totals.offers ||
          ranking) && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Métricas del período
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard
                icon={<Eye className="w-4 h-4" />}
                value={totals.impressions}
                label="Impresiones"
                color="blue"
              />
              <MetricCard
                icon={<MousePointerClick className="w-4 h-4" />}
                value={totals.portal_visits}
                label="Visitas al portal"
                color="cyan"
              />
              <MetricCard
                icon={<MessageSquare className="w-4 h-4" />}
                value={totals.inquiries}
                label="Consultas"
                color="purple"
              />
              <MetricCard
                icon={<Home className="w-4 h-4" />}
                value={totals.in_person_visits}
                label="Visitas presenciales"
                color="green"
              />
              <MetricCard
                icon={<HandCoins className="w-4 h-4" />}
                value={totals.offers}
                label="Ofertas"
                color="amber"
              />
              {ranking && (
                <div
                  className="rounded-xl p-3 text-white flex flex-col justify-between"
                  style={{
                    background: `linear-gradient(135deg, ${brand} 0%, #ff5e3a 100%)`,
                  }}
                >
                  <Trophy className="w-4 h-4 opacity-90" />
                  <div>
                    <div className="text-2xl font-bold leading-none">#{ranking.position}</div>
                    <div className="text-[11px] opacity-90 mt-1">Ranking en {ranking.source}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Conversion funnel */}
        {(totals.impressions || totals.portal_visits || totals.inquiries || totals.in_person_visits) && (
          <ConversionFunnel totals={totals} brand={brand} />
        )}

        {/* Content sections */}
        {content.length > 0 && (
          <section className="space-y-4">
            {content
              .slice()
              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((s: any) => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
                >
                  <h2 className="font-semibold text-ink mb-2">
                    {s.title || SECTION_TITLES[s.section as string] || 'Sección'}
                  </h2>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {s.body}
                  </div>
                </div>
              ))}
          </section>
        )}

        {/* Competitors */}
        {competitors.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-ink mb-1">
              Propiedades comparables ({competitors.length})
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Avisos similares en venta usados como referencia de mercado.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {competitors.map((c: any) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-gray-100 p-3 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {c.address || 'Sin dirección'}
                      </p>
                      {c.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.notes}</p>
                      )}
                    </div>
                    {c.price != null && (
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{ color: brand }}
                      >
                        USD {formatNumber(c.price)}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Visit forms */}
        {visit_forms.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-ink mb-1">
              Fichas de visita ({visit_forms.length})
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Devoluciones de las personas que visitaron la propiedad.
            </p>
            <div className="divide-y divide-gray-100">
              {visit_forms.map((vf: any) => (
                <VisitFormCard key={vf.id} vf={vf} />
              ))}
            </div>
          </section>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-ink mb-4">Fotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo: any) => (
                <img
                  key={photo.id}
                  src={photo.photo_url}
                  alt={photo.caption || 'Foto'}
                  className="w-full aspect-square object-cover rounded-xl"
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-gray-600">
          Reporte generado por <span className="font-semibold">{org?.name}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Potenciado por <span style={{ color: brand }} className="font-semibold">VendéPro</span>
        </p>
      </footer>
    </div>
  )
}

function ReportSelector({
  current,
  available,
  periodFmt,
  brand,
}: {
  current: any
  available: any[]
  periodFmt: string
  brand: string
}) {
  const others = available.filter((r) => !r.is_current)
  // Si solo existe el reporte actual, render simple sin dropdown
  if (others.length === 0) {
    return (
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-gray-400">Reporte</div>
        <div className="text-sm font-medium text-gray-700">{current?.period_label}</div>
        <div className="text-xs text-gray-500">{periodFmt}</div>
      </div>
    )
  }

  return (
    <details className="hidden sm:block relative text-right group" data-selector="reports">
      <summary
        className="list-none cursor-pointer select-none"
        style={{ outline: 'none' }}
      >
        <div className="text-xs uppercase tracking-wide text-gray-400 flex items-center justify-end gap-1">
          Reporte
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-sm font-medium text-gray-700 hover:text-ink">
          {current?.period_label}
        </div>
        <div className="text-xs text-gray-500">{periodFmt}</div>
      </summary>
      <div className="absolute right-0 top-full mt-2 z-10 w-72 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden text-left">
        <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-100">
          Otros reportes
        </div>
        <div className="max-h-80 overflow-y-auto">
          {available.map((r) => (
            <a
              key={r.slug}
              href={`/r/${r.slug}`}
              className={`block px-3 py-2.5 hover:bg-gray-50 ${
                r.is_current ? 'bg-gray-50/60' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink truncate">
                  {r.period_label}
                </span>
                {r.is_current && (
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: brand }}
                  >
                    Actual
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {formatDate(r.period_start)} – {formatDate(r.period_end)}
              </div>
            </a>
          ))}
        </div>
      </div>
    </details>
  )
}

function Pill({
  label,
  value,
  emphasize,
  color,
}: {
  label: string
  value: string
  emphasize?: boolean
  color?: string
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div
        className={`font-semibold ${emphasize ? 'text-base' : 'text-sm text-gray-700'}`}
        style={emphasize && color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: number | null
  label: string
  color: 'blue' | 'cyan' | 'purple' | 'green' | 'amber'
}) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }[color]
  return (
    <div className={`rounded-xl p-3 border flex flex-col justify-between ${cls}`}>
      <div className="opacity-70">{icon}</div>
      <div>
        <div className="text-2xl font-bold leading-none">{value != null ? formatNumber(value) : '—'}</div>
        <div className="text-[11px] opacity-80 mt-1">{label}</div>
      </div>
    </div>
  )
}

function ConversionFunnel({
  totals,
  brand,
}: {
  totals: ReturnType<typeof aggregateMetrics>
  brand: string
}) {
  const stages = [
    { label: 'Impresiones', value: totals.impressions },
    { label: 'Visitas portal', value: totals.portal_visits },
    { label: 'Consultas', value: totals.inquiries },
    { label: 'Visitas presenc.', value: totals.in_person_visits },
    { label: 'Ofertas', value: totals.offers },
  ].filter((s) => s.value != null)
  const max = Math.max(...stages.map((s) => s.value || 0))
  if (max === 0 || stages.length < 2) return null

  // Paleta fija por etapa, en el espíritu del diseño de referencia.
  // Mantiene los colores de marca (rosa + naranja) en las etapas 2 y 3.
  const PALETTE = ['#7c5cff', '#ff007c', '#ff8017', '#10b981', '#f59e0b']

  // Distribuyo el ancho linealmente entre 100% (primera) y 40% (última)
  // — el funnel comunica "embudo" por forma, los valores van como label.
  const TOP = 100
  const BOTTOM_LAST = 40
  const step = (TOP - BOTTOM_LAST) / stages.length
  const widthAt = (i: number) => TOP - step * i

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-4 rounded-sm" style={{ backgroundColor: brand }} />
        Embudo de conversión
      </h2>
      <div className="max-w-2xl mx-auto">
        {stages.map((s, i) => {
          const topPct = widthAt(i)
          const botPct = widthAt(i + 1)
          const insetTop = (100 - topPct) / 2
          const insetBot = (100 - botPct) / 2
          const clip = `polygon(${insetTop}% 0%, ${100 - insetTop}% 0%, ${100 - insetBot}% 100%, ${insetBot}% 100%)`
          return (
            <div
              key={s.label}
              className="relative h-14 flex items-center justify-center text-white text-center"
              style={{ backgroundColor: PALETTE[i % PALETTE.length], clipPath: clip }}
            >
              <div>
                <div className="text-[11px] font-semibold leading-tight opacity-95">{s.label}</div>
                <div className="text-base font-bold leading-tight">{formatNumber(s.value || 0)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function VisitFormCard({ vf }: { vf: any }) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <h3 className="font-semibold text-ink truncate">
            {vf.visitor_name || 'Visitante'}
          </h3>
          <span className="text-xs text-gray-500">{formatDate(vf.submitted_at)}</span>
        </div>
        {vf.rating != null && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-4 h-4 ${
                  n <= vf.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {vf.liked && (
          <div className="rounded-lg bg-green-50/60 border border-green-100 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1">
              <ThumbsUp className="w-3.5 h-3.5" /> Le gustó
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{vf.liked}</p>
          </div>
        )}
        {vf.disliked && (
          <div className="rounded-lg bg-red-50/60 border border-red-100 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-700 mb-1">
              <ThumbsDown className="w-3.5 h-3.5" /> No le gustó
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{vf.disliked}</p>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {vf.buy_intention === 'compraria' && <Tag color="green">Compraría</Tag>}
        {vf.buy_intention === 'no' && <Tag color="red">No compraría</Tag>}
        {vf.buy_intention === 'tal_vez' && <Tag color="amber">Tal vez</Tag>}
        {vf.situation && <Tag color="gray">{SITUATION_LABEL[vf.situation] ?? vf.situation}</Tag>}
        {vf.source && <Tag color="orange">Vía: {SOURCE_LABEL[vf.source] ?? vf.source}</Tag>}
      </div>

      {vf.observations && (
        <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{vf.observations}&rdquo;</p>
      )}
    </div>
  )
}

function Tag({
  color,
  children,
}: {
  color: 'green' | 'red' | 'amber' | 'gray' | 'orange'
  children: React.ReactNode
}) {
  const cls = {
    green: 'bg-green-100 text-green-700 border-green-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
  }[color]
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  )
}

function aggregateMetrics(metrics: any[]) {
  const sumNullable = (key: string) => {
    let total: number | null = null
    for (const m of metrics) {
      if (m?.[key] != null) total = (total ?? 0) + Number(m[key])
    }
    return total
  }
  return {
    impressions: sumNullable('impressions'),
    portal_visits: sumNullable('portal_visits'),
    inquiries: sumNullable('inquiries'),
    in_person_visits: sumNullable('in_person_visits'),
    offers: sumNullable('offers'),
  }
}

function pickRanking(metrics: any[]): { position: number; source: string } | null {
  for (const m of metrics) {
    if (m?.ranking_position != null) {
      return { position: Number(m.ranking_position), source: cap(String(m.source ?? 'portal')) }
    }
  }
  return null
}

function formatNumber(n: number): string {
  return Number(n).toLocaleString('es-AR')
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
