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

  const { property, org, report, metrics = [], content = [], photos = [], visit_forms = [] } = data
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
              <div className="text-sm font-semibold text-gray-900 truncate">{org?.name}</div>
              <div className="text-xs text-gray-500">Operaciones Inmobiliarias</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-400">Reporte</div>
            <div className="text-sm font-medium text-gray-700">{report?.period_label}</div>
            <div className="text-xs text-gray-500">{periodFmt}</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
                <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
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
                  <h2 className="font-semibold text-gray-900 mb-2">{s.title}</h2>
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {s.body}
                  </div>
                </div>
              ))}
          </section>
        )}

        {/* Visit forms */}
        {visit_forms.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-1">
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
            <h2 className="font-semibold text-gray-900 mb-4">Fotos</h2>
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
    { label: 'Visitas al portal', value: totals.portal_visits },
    { label: 'Consultas', value: totals.inquiries },
    { label: 'Visitas presenciales', value: totals.in_person_visits },
    { label: 'Ofertas', value: totals.offers },
  ].filter((s) => s.value != null)
  const max = Math.max(...stages.map((s) => s.value || 0))
  if (max === 0 || stages.length < 2) return null

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
        Embudo de conversión
      </h2>
      <div className="space-y-2">
        {stages.map((s) => {
          const pct = Math.max(((s.value || 0) / max) * 100, 8)
          return (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-32 sm:w-40 text-xs text-gray-600 flex-shrink-0">{s.label}</div>
              <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                <div
                  className="h-full flex items-center justify-end pr-2 text-xs font-semibold text-white"
                  style={{ width: `${pct}%`, backgroundColor: brand }}
                >
                  {formatNumber(s.value || 0)}
                </div>
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
          <h3 className="font-semibold text-gray-900 truncate">
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
        <p className="mt-2 text-sm text-gray-600 italic">"{vf.observations}"</p>
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
