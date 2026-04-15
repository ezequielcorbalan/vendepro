import { getDB } from '@/lib/db'
import { notFound } from 'next/navigation'
import {
  MapPin, Building2, Calculator, TrendingUp, CheckCircle, Clock,
  BarChart3, DollarSign, Ruler, Home, MessageCircle, Phone, Video
} from 'lucide-react'

async function getOrgBranding(orgId: string) {
  const db = await getDB()
  const org = await db.prepare(
    'SELECT name, logo_url, brand_color, brand_accent_color FROM organizations WHERE id = ?'
  ).bind(orgId).first() as any
  return {
    name: org?.name || 'Inmobiliaria',
    logo_url: org?.logo_url || '/logo.png',
    primary: org?.brand_color || '#ff007c',
    accent: org?.brand_accent_color || '#ff8017',
  }
}

async function getOrgSettings(orgId: string) {
  const db = await getDB()
  try {
    const settings = (await db.prepare(
      'SELECT setting_key, setting_value FROM org_settings WHERE org_id = ?'
    ).bind(orgId).all()).results as any[]
    const result: Record<string, string> = {}
    for (const s of settings) result[s.setting_key] = s.setting_value
    return result
  } catch { return {} }
}

function parseJson(value: any, fallback: any = []) {
  if (!value) return fallback
  try { return typeof value === 'string' ? JSON.parse(value) : value } catch { return fallback }
}

export default async function PrefactibilidadPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const db = await getDB()

  const prefact = await db.prepare(`
    SELECT p.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM prefactibilidades p LEFT JOIN users u ON p.agent_id = u.id
    WHERE p.public_slug = ?
  `).bind(slug).first() as any

  if (!prefact) notFound()

  const orgId = prefact.org_id || 'org_mg'
  const brand = await getOrgBranding(orgId)
  const settings = await getOrgSettings(orgId)
  const { primary, accent } = brand

  const unitsMix = parseJson(prefact.units_mix, [])
  const amenities = parseJson(prefact.amenities, [])
  const comparables = parseJson(prefact.comparables, [])
  const timeline = parseJson(prefact.timeline, [])

  const whatsapp = settings.tasacion_cta_whatsapp || '5491158905594'
  const calendlyUrl = settings.tasacion_cta_calendly || ''

  const gradientStyle = { background: `linear-gradient(to right, ${primary}, ${accent})` }
  const gradientVStyle = { background: `linear-gradient(to bottom, ${primary}, ${accent})` }

  const totalComparablePrice = comparables.length > 0
    ? comparables.reduce((sum: number, c: any) => sum + (Number(c.price_per_m2) || 0), 0) / comparables.filter((c: any) => Number(c.price_per_m2) > 0).length
    : 0

  const totalMonths = timeline.reduce((sum: number, t: any) => sum + (Number(t.months) || 0), 0)

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden bg-white border-b border-gray-100">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 sm:w-2" style={gradientVStyle} />
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
          <div className="flex items-center gap-3 mb-6">
            <img src={brand.logo_url} alt={brand.name} className="h-8 sm:h-12" />
            <span className="text-gray-400 font-medium text-sm">Operaciones Inmobiliarias</span>
          </div>
          <div className="inline-block rounded-full px-4 py-1.5 mb-4" style={gradientStyle}>
            <p className="text-white text-xs sm:text-sm font-medium tracking-wider uppercase">Estudio de Prefactibilidad</p>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3 text-gray-800">
            {prefact.project_name || prefact.address}
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 font-light">
            {prefact.address}{prefact.neighborhood ? `, ${prefact.neighborhood}` : ''}
          </p>

          {prefact.agent_name && (
            <div className="mt-8 inline-flex items-center gap-4 bg-[#f8f8f8] rounded-2xl px-5 py-3">
              <div className="rounded-full flex items-center justify-center font-bold text-white w-11 h-11" style={gradientStyle}>
                {prefact.agent_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{prefact.agent_name}</p>
                <p className="text-xs" style={{ color: primary }}>{prefact.agent_phone}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-8 sm:space-y-10">

        {/* Summary KPIs */}
        {(prefact.total_investment || prefact.projected_revenue) && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {prefact.total_investment && (
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Inversión</p>
                <p className="text-xl sm:text-2xl font-black text-gray-800">USD {Number(prefact.total_investment).toLocaleString('es-AR')}</p>
              </div>
            )}
            {prefact.projected_revenue && (
              <div className="bg-green-50 rounded-2xl p-5 border border-green-100">
                <p className="text-xs text-green-600 uppercase tracking-wider mb-1">Ingresos proyec.</p>
                <p className="text-xl sm:text-2xl font-black text-green-700">USD {Number(prefact.projected_revenue).toLocaleString('es-AR')}</p>
              </div>
            )}
            {prefact.gross_margin && (
              <div className="rounded-2xl p-5 border" style={{ background: `${primary}0D`, borderColor: `${primary}33` }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: primary }}>Margen</p>
                <p className="text-xl sm:text-2xl font-black" style={{ color: primary }}>USD {Number(prefact.gross_margin).toLocaleString('es-AR')}</p>
              </div>
            )}
            {prefact.margin_pct && (
              <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-5 border border-pink-100">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">ROI</p>
                <p className="text-xl sm:text-2xl font-black bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                  {Number(prefact.margin_pct).toFixed(1)}%
                </p>
              </div>
            )}
          </section>
        )}

        {/* Datos del terreno */}
        <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
            <MapPin className="w-5 h-5" style={{ color: primary }} />
            Datos del terreno
          </h2>
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {prefact.lot_area && (
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Superficie</p>
                  <p className="text-lg font-black text-gray-800">{prefact.lot_area} <span className="text-xs font-normal text-gray-400">m²</span></p></div>
              )}
              {prefact.lot_frontage && (
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Frente</p>
                  <p className="text-lg font-black text-gray-800">{prefact.lot_frontage}<span className="text-xs font-normal text-gray-400">m</span></p></div>
              )}
              {prefact.lot_depth && (
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Fondo</p>
                  <p className="text-lg font-black text-gray-800">{prefact.lot_depth}<span className="text-xs font-normal text-gray-400">m</span></p></div>
              )}
              {prefact.zoning && (
                <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Zonificación</p>
                  <p className="text-lg font-black text-gray-800">{prefact.zoning}</p></div>
              )}
            </div>
            {(prefact.fot || prefact.fos || prefact.max_height) && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                {prefact.fot && <div><p className="text-[10px] text-gray-400 uppercase">FOT</p><p className="text-base font-bold text-gray-700">{prefact.fot}</p></div>}
                {prefact.fos && <div><p className="text-[10px] text-gray-400 uppercase">FOS</p><p className="text-base font-bold text-gray-700">{prefact.fos}</p></div>}
                {prefact.max_height && <div><p className="text-[10px] text-gray-400 uppercase">Altura máx.</p><p className="text-base font-bold text-gray-700">{prefact.max_height}</p></div>}
              </div>
            )}
            {prefact.lot_price && (
              <div className="mt-5 pt-5 border-t border-gray-100 flex items-baseline gap-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Precio del terreno:</p>
                <p className="text-2xl font-black" style={{ color: primary }}>USD {Number(prefact.lot_price).toLocaleString('es-AR')}</p>
                {prefact.lot_price_per_m2 && (
                  <p className="text-sm text-gray-400">USD {Number(prefact.lot_price_per_m2).toFixed(0)}/m²</p>
                )}
              </div>
            )}
          </div>
          {prefact.lot_description && (
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-4">{prefact.lot_description}</p>
          )}
        </section>

        {/* Proyecto */}
        {(prefact.project_name || prefact.buildable_area || unitsMix.length > 0) && (
          <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Building2 className="w-5 h-5" style={{ color: primary }} />
              Proyecto propuesto
            </h2>
            {prefact.project_description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-5">{prefact.project_description}</p>
            )}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {prefact.buildable_area && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">M² construibles</p>
                  <p className="text-2xl font-black text-gray-800 mt-1">{Number(prefact.buildable_area).toLocaleString('es-AR')}</p>
                </div>
              )}
              {prefact.total_units && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Unidades</p>
                  <p className="text-2xl font-black text-gray-800 mt-1">{prefact.total_units}</p>
                </div>
              )}
              {prefact.parking_spots && (
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Cocheras</p>
                  <p className="text-2xl font-black text-gray-800 mt-1">{prefact.parking_spots}</p>
                </div>
              )}
            </div>

            {unitsMix.length > 0 && (
              <div className="bg-white rounded-xl p-5 border border-gray-100 mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Mix de tipologías</p>
                <div className="space-y-2">
                  {unitsMix.map((u: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700">{u.type}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{u.avg_m2}m²</span>
                        <span className="text-sm font-bold text-gray-800">{u.count} unid.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {amenities.map((a: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium text-white" style={gradientStyle}>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Análisis económico */}
        {prefact.total_investment && (
          <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Calculator className="w-5 h-5" style={{ color: primary }} />
              Análisis económico
            </h2>
            <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
              {prefact.lot_price && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Terreno</span><span className="font-semibold text-gray-800">USD {Number(prefact.lot_price).toLocaleString('es-AR')}</span></div>
              )}
              {prefact.total_construction_cost && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Construcción</span><span className="font-semibold text-gray-800">USD {Number(prefact.total_construction_cost).toLocaleString('es-AR')}</span></div>
              )}
              {prefact.professional_fees && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Honorarios profesionales</span><span className="font-semibold text-gray-800">USD {Number(prefact.professional_fees).toLocaleString('es-AR')}</span></div>
              )}
              {prefact.permits_cost && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Permisos</span><span className="font-semibold text-gray-800">USD {Number(prefact.permits_cost).toLocaleString('es-AR')}</span></div>
              )}
              {prefact.commercialization_cost && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Comercialización</span><span className="font-semibold text-gray-800">USD {Number(prefact.commercialization_cost).toLocaleString('es-AR')}</span></div>
              )}
              {prefact.other_costs && (
                <div className="flex justify-between text-sm"><span className="text-gray-500">Otros</span><span className="font-semibold text-gray-800">USD {Number(prefact.other_costs).toLocaleString('es-AR')}</span></div>
              )}
              <div className="pt-3 border-t border-gray-200 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Inversión total</span>
                <span className="text-lg font-black text-gray-800">USD {Number(prefact.total_investment).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {prefact.projected_revenue && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-green-50 rounded-xl p-5 border border-green-100">
                  <p className="text-xs text-green-600 uppercase tracking-wider mb-2">Ingresos proyectados</p>
                  <p className="text-2xl font-black text-green-700">USD {Number(prefact.projected_revenue).toLocaleString('es-AR')}</p>
                  {prefact.avg_sale_price_per_m2 && (
                    <p className="text-xs text-green-600 mt-1">USD {Number(prefact.avg_sale_price_per_m2).toLocaleString('es-AR')}/m² × {Number(prefact.total_sellable_area || 0).toLocaleString('es-AR')}m²</p>
                  )}
                </div>
                <div className="rounded-xl p-5 border" style={{ background: `${primary}0D`, borderColor: `${primary}33` }}>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: primary }}>Retorno esperado</p>
                  <p className="text-2xl font-black" style={{ color: primary }}>USD {Number(prefact.gross_margin).toLocaleString('es-AR')}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: primary }}>{Number(prefact.margin_pct).toFixed(1)}% ROI</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Comparables */}
        {comparables.length > 0 && (
          <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" style={{ color: primary }} />
              Comparables de la zona
              {totalComparablePrice > 0 && (
                <span className="ml-auto text-xs text-gray-400">Promedio: USD {totalComparablePrice.toFixed(0)}/m²</span>
              )}
            </h2>
            <div className="space-y-2">
              {comparables.map((c: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{c.project}</p>
                    {c.notes && <p className="text-xs text-gray-400 truncate">{c.notes}</p>}
                  </div>
                  {c.price_per_m2 && (
                    <p className="text-base font-black" style={{ color: primary }}>USD {Number(c.price_per_m2).toLocaleString('es-AR')}/m²</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timeline */}
        {timeline.length > 0 && (
          <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: primary }} />
              Cronograma
              {totalMonths > 0 && <span className="ml-auto text-xs text-gray-400">Total: {totalMonths} meses</span>}
            </h2>
            <div className="relative pl-6">
              <div className="absolute left-2 top-3 bottom-3 w-0.5" style={gradientVStyle} />
              {timeline.map((t: any, i: number) => (
                <div key={i} className="relative mb-3 last:mb-0">
                  <div className="absolute left-[-18px] top-4 w-3 h-3 rounded-full ring-4 ring-[#f8f8f8]" style={{ background: primary }} />
                  <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{t.phase}</span>
                    <span className="text-xs font-bold text-gray-500">{t.months} meses</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conclusión */}
        {(prefact.executive_summary || prefact.recommendation) && (
          <section className="bg-[#f8f8f8] rounded-2xl p-5 sm:p-8 border border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" style={{ color: primary }} />
              Conclusión
            </h2>
            {prefact.executive_summary && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumen ejecutivo</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prefact.executive_summary}</p>
              </div>
            )}
            {prefact.recommendation && (
              <div className="bg-white rounded-xl p-5 border" style={{ borderColor: `${primary}33` }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: primary }}>Recomendación</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{prefact.recommendation}</p>
              </div>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="relative bg-[#f8f8f8] rounded-2xl p-8 sm:p-16 text-center border border-gray-100">
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={gradientStyle} />
          <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mb-3">Siguiente paso</p>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 mb-4">¿Querés avanzar con esta oportunidad?</h2>
          <p className="text-gray-500 mb-10 max-w-lg mx-auto text-sm sm:text-base">
            Coordinemos una reunión para evaluar el proyecto en detalle.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {calendlyUrl && (
              <a href={calendlyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:opacity-90 shadow-lg w-full sm:w-auto justify-center"
                style={{ ...gradientStyle, boxShadow: `0 10px 25px -5px ${primary}40` }}>
                <Video className="w-5 h-5" /> Agendar reunión
              </a>
            )}
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, vi la prefactibilidad de ${prefact.address} y quiero avanzar.`)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-green-600 shadow-lg shadow-green-200 w-full sm:w-auto justify-center">
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
            {prefact.agent_phone && (
              <a href={`tel:${prefact.agent_phone}`}
                className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-50 w-full sm:w-auto justify-center">
                <Phone className="w-5 h-5" /> Llamar
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <img src={brand.logo_url} alt={brand.name} className="h-10 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{brand.name} · Operaciones Inmobiliarias</p>
          {prefact.agent_name && (
            <div className="flex items-center justify-center gap-4 mt-3 text-gray-400 text-xs">
              <span>{prefact.agent_name}</span>
              {prefact.agent_phone && <span>· <span style={{ color: primary }}>{prefact.agent_phone}</span></span>}
              {prefact.agent_email && <span>· {prefact.agent_email}</span>}
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
