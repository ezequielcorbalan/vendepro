import { getDB } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Ruler, Shield, TrendingUp, Calendar, DollarSign, Phone, Video, MessageCircle, Home, Eye, Clock, Monitor, BarChart3 } from 'lucide-react'

function youtubeEmbed(url: string) {
  if (!url) return null
  // Convert any youtube URL to nocookie embed
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  // Already an embed URL, swap domain
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  if (url.includes('youtube-nocookie.com')) return url
  return url
}

async function getOrgSettings() {
  const db = await getDB()
  const settings = (await db.prepare(
    "SELECT setting_key, setting_value FROM org_settings WHERE org_id = 'org_mg'"
  ).all()).results as any[]
  const result: Record<string, string> = {}
  for (const s of settings) result[s.setting_key] = s.setting_value
  return result
}

async function getSoldProperties(appraisalId: string, neighborhood: string) {
  const db = await getDB()
  // First try linked sold properties for this appraisal
  let results = (await db.prepare(
    `SELECT sp.* FROM sold_properties sp
     INNER JOIN appraisal_sold_properties asp ON sp.id = asp.sold_property_id
     WHERE asp.appraisal_id = ? ORDER BY sp.sold_date DESC`
  ).bind(appraisalId).all()).results as any[]
  // Fallback to neighborhood if no linked props
  if (results.length === 0) {
    results = (await db.prepare(
      'SELECT * FROM sold_properties WHERE neighborhood = ? ORDER BY sold_date DESC LIMIT 5'
    ).bind(neighborhood).all()).results as any[]
  }
  return results
}

export default async function TasacionPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ modo?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const presentationMode = sp.modo === 'presentacion'
  const db = await getDB()

  const appraisal = await db.prepare(`
    SELECT a.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email, u.photo_url as agent_photo
    FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id
    WHERE a.public_slug = ?
  `).bind(slug).first() as any

  if (!appraisal) notFound()

  const comparables = (await db.prepare(
    'SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order'
  ).bind(appraisal.id).all()).results as any[]

  const settings = await getOrgSettings()
  const soldProps = await getSoldProperties(appraisal.id, appraisal.neighborhood)

  const a = appraisal
  const weighted = Number(a.weighted_area) || 0
  const usdM2 = Number(a.usd_per_m2) || 0
  const whatsapp = settings.tasacion_cta_whatsapp || '5491158905594'
  const calendlyUrl = settings.tasacion_cta_calendly || ''

  const containerClass = presentationMode
    ? 'min-h-screen bg-gray-900'
    : 'min-h-screen bg-white'
  const cardClass = presentationMode
    ? 'bg-gray-800/80 backdrop-blur rounded-2xl shadow-2xl border border-gray-700/50 text-white'
    : 'bg-[#f8f8f8] rounded-2xl border border-gray-100'
  const textClass = presentationMode ? 'text-gray-200' : 'text-gray-600'
  const headingClass = presentationMode ? 'text-white' : 'text-gray-800'

  return (
    <div className={containerClass}>
      {/* Presentation mode toggle */}
      {!presentationMode && (
        <a
          href={`/t/${slug}?modo=presentacion`}
          className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
          title="Modo presentaci&oacute;n (para TV/proyector)"
        >
          <Monitor className="w-5 h-5" />
        </a>
      )}
      {presentationMode && (
        <a
          href={`/t/${slug}`}
          className="fixed bottom-4 right-4 z-50 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
          title="Volver a modo normal"
        >
          <Monitor className="w-5 h-5" />
        </a>
      )}

      {/* Hero — White bg with brand gradient accent */}
      <header className="relative overflow-hidden bg-white border-b border-gray-100">
        {/* Left gradient accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 sm:w-2 bg-gradient-to-b from-[#ff007c] to-[#ff8017]" />
        <div className={`max-w-5xl mx-auto px-6 sm:px-10 ${presentationMode ? 'py-20 sm:py-28' : 'py-10 sm:py-16'}`}>
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Marcela Genta" className={`${presentationMode ? 'h-12 sm:h-16' : 'h-8 sm:h-12'}`} />
            <span className={`text-gray-400 font-medium ${presentationMode ? 'text-base' : 'text-sm'}`}>Operaciones Inmobiliarias</span>
          </div>
          <div className="inline-block bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-full px-4 py-1.5 mb-4">
            <p className="text-white text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasaci&oacute;n</p>
          </div>
          <h1 className={`font-black leading-tight mb-3 text-gray-800 ${presentationMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'}`}>{a.property_address}</h1>
          <p className={`text-gray-400 font-light ${presentationMode ? 'text-lg sm:text-2xl' : 'text-lg sm:text-xl'}`}>{a.neighborhood}, {a.city}</p>

          {/* Agent card */}
          <div className="mt-8 inline-flex items-center gap-4 bg-[#f8f8f8] rounded-2xl px-5 py-3">
            {a.agent_photo ? (
              <img src={a.agent_photo} alt={a.agent_name} className={`rounded-full object-cover ring-2 ring-pink-200 ${presentationMode ? 'w-14 h-14' : 'w-11 h-11'}`} />
            ) : (
              <div className={`rounded-full bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center font-bold text-white ${presentationMode ? 'w-14 h-14 text-xl' : 'w-11 h-11'}`}>
                {(a.agent_name || 'A').charAt(0)}
              </div>
            )}
            <div>
              <p className={`font-semibold text-gray-800 ${presentationMode ? 'text-base' : 'text-sm'}`}>{a.agent_name}</p>
              <p className={`text-[#ff007c] ${presentationMode ? 'text-sm' : 'text-xs'}`}>{a.agent_phone}</p>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-8 sm:space-y-10 ${presentationMode ? 'text-lg' : ''}`}>

        {/* ====== SECTION 1: PARTE COMERCIAL ====== */}

        {settings.tasacion_video_comercial && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="aspect-video">
              <iframe src={youtubeEmbed(settings.tasacion_video_comercial)!} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            {settings.tasacion_texto_comercial && (
              <div className="p-5 sm:p-8">
                <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
                  <span className="w-1 h-7 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
                  Nuestra propuesta comercial
                </h2>
                <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_comercial}</p>
              </div>
            )}
          </section>
        )}

        {settings.tasacion_texto_servicios && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-7 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
              Qu&eacute; hacemos para vender al mejor valor
            </h2>
            <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_servicios}</p>
          </section>
        )}

        {(settings.tasacion_datos_props_publicadas || settings.tasacion_datos_escrituras_mes) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
              <span className="w-1 h-7 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
              Situaci&oacute;n del mercado
            </h2>
            {settings.tasacion_video_mercado && (
              <div className="aspect-video rounded-xl overflow-hidden mb-6">
                <iframe src={youtubeEmbed(settings.tasacion_video_mercado)!} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            )}
            {settings.tasacion_datos_mes_referencia && (
              <p className={`text-xs ${presentationMode ? 'text-gray-500' : 'text-gray-400'} mb-3`}>Datos de {settings.tasacion_datos_mes_referencia}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {settings.tasacion_datos_props_publicadas && (
                <div className={`${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-indigo-50 to-white border border-indigo-100'} rounded-2xl p-6 text-center`}>
                  <Home className={`w-7 h-7 ${presentationMode ? 'text-indigo-300' : 'text-indigo-500'} mx-auto mb-3`} />
                  <p className={`font-bold ${headingClass} ${presentationMode ? 'text-4xl' : 'text-3xl sm:text-4xl'}`}>{Number(settings.tasacion_datos_props_publicadas).toLocaleString('es-AR')}</p>
                  <p className={`text-sm mt-1 ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Propiedades en venta</p>
                </div>
              )}
              {settings.tasacion_datos_vendidas_mes && Number(settings.tasacion_datos_props_publicadas) > 0 && (
                <div className={`${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-green-50 to-white border border-green-100'} rounded-2xl p-6 text-center`}>
                  <TrendingUp className={`w-7 h-7 ${presentationMode ? 'text-green-300' : 'text-green-500'} mx-auto mb-3`} />
                  <p className={`font-bold ${headingClass} ${presentationMode ? 'text-4xl' : 'text-3xl sm:text-4xl'}`}>
                    {(Number(settings.tasacion_datos_vendidas_mes) / Number(settings.tasacion_datos_props_publicadas) * 100).toFixed(1)}%
                  </p>
                  <p className={`text-sm mt-1 ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Se vende por mes ({Number(settings.tasacion_datos_vendidas_mes).toLocaleString('es-AR')})</p>
                </div>
              )}
              {settings.tasacion_datos_escrituras_mes && (
                <div className={`${presentationMode ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-br from-orange-50 to-white border border-orange-100'} rounded-2xl p-6 text-center`}>
                  <Calendar className={`w-7 h-7 ${presentationMode ? 'text-orange-300' : 'text-orange-500'} mx-auto mb-3`} />
                  <p className={`font-bold ${headingClass} ${presentationMode ? 'text-4xl' : 'text-3xl sm:text-4xl'}`}>{Number(settings.tasacion_datos_escrituras_mes).toLocaleString('es-AR')}</p>
                  <p className={`text-sm mt-1 ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Escrituras por mes</p>
                </div>
              )}
            </div>
          </section>
        )}

        {settings.tasacion_texto_embudo && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-7 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
              Embudo de ventas y seguimiento
            </h2>
            <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_embudo}</p>
            {settings.tasacion_texto_reportes && (
              <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap mt-4 pt-4 border-t ${presentationMode ? 'border-gray-700' : 'border-gray-100'}`}>{settings.tasacion_texto_reportes}</p>
            )}
          </section>
        )}

        {/* ====== DIVIDER ====== */}
        <div className="relative py-8">
          <div className="absolute inset-0 flex items-center"><div className={`w-full h-px ${presentationMode ? 'bg-gradient-to-r from-transparent via-[#ff007c]/40 to-transparent' : 'bg-gradient-to-r from-transparent via-[#ff007c]/20 to-transparent'}`} /></div>
          <div className="relative flex justify-center">
            <span className={`px-8 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${presentationMode ? 'bg-gray-900 text-[#ff007c]' : 'bg-white text-[#ff007c] shadow-sm border border-pink-100 rounded-full'}`}>Tasaci&oacute;n de tu propiedad</span>
          </div>
        </div>

        {/* ====== SECTION 2: TASACIÓN VARIABLE ====== */}

        {/* Agent notes / explanation */}
        {a.agent_notes && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-7 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
              Explicaci&oacute;n de la tasaci&oacute;n
            </h2>
            <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{a.agent_notes}</p>
          </section>
        )}

        {a.video_url && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="aspect-video">
              <iframe src={youtubeEmbed(a.video_url)!} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </section>
        )}

        {/* Property data */}
        <section className={`${cardClass} p-5 sm:p-8`}>
          <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
            <Ruler className="w-5 h-5 text-[#ff007c]" />
            Datos de la propiedad
          </h2>
          {/* Table style like image 8 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Tipolog&iacute;a</p>
                <p className={`font-black text-lg ${headingClass} capitalize`}>{a.property_type}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Cubierta</p>
                <p className={`font-black text-lg ${headingClass}`}>{a.covered_area || '-'} <span className="text-sm font-normal text-gray-400">m&sup2;</span></p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total</p>
                <p className={`font-black text-lg ${headingClass}`}>{a.total_area || '-'} <span className="text-sm font-normal text-gray-400">m&sup2;</span></p>
              </div>
              <div className="p-4 text-center bg-gradient-to-br from-[#ff007c]/5 to-[#ff8017]/5">
                <p className="text-[10px] text-[#ff007c] uppercase tracking-wider font-bold mb-1">Ponderada</p>
                <p className="font-black text-lg text-[#ff007c]">{weighted.toFixed(1)} <span className="text-sm font-normal">m&sup2;</span></p>
              </div>
            </div>
            {(a.semi_area || a.total_area !== a.covered_area) && (
              <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
                {a.semi_area && <span>Semicubierta: {a.semi_area} m&sup2;</span>}
                {a.total_area && a.covered_area && Number(a.total_area) !== Number(a.covered_area) && (
                  <span>Descubierta: {(Number(a.total_area) - Number(a.covered_area) - (Number(a.semi_area) || 0)).toFixed(0)} m&sup2;</span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Zone averages */}
        {(a.zone_avg_price || a.zone_avg_m2 || a.zone_avg_usd_m2) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Valores promedio en {a.neighborhood}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {a.zone_avg_price && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Precio promedio</p>
                  <p className={`font-black text-gray-800 ${presentationMode ? 'text-3xl' : 'text-2xl'}`}>USD {Number(a.zone_avg_price).toLocaleString('es-AR')}</p>
                </div>
              )}
              {a.zone_avg_m2 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">m&sup2; promedio</p>
                  <p className={`font-black text-gray-800 ${presentationMode ? 'text-3xl' : 'text-2xl'}`}>{Number(a.zone_avg_m2).toLocaleString('es-AR')}</p>
                </div>
              )}
              {a.zone_avg_usd_m2 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
                  <p className="text-[10px] text-[#ff007c] uppercase tracking-wider font-bold mb-1">USD/m&sup2;</p>
                  <p className={`font-black text-[#ff007c] ${presentationMode ? 'text-3xl' : 'text-2xl'}`}>{Number(a.zone_avg_usd_m2).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FODA */}
        {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
              <Shield className="w-5 h-5 text-indigo-500" /> An&aacute;lisis FODA
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {a.strengths && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="inline-block bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Fortalezas</span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{a.strengths}</p>
                </div>
              )}
              {a.opportunities && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="inline-block bg-gradient-to-r from-[#ff8017] to-[#ffb347] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Oportunidades</span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{a.opportunities}</p>
                </div>
              )}
              {a.weaknesses && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="inline-block bg-gray-400 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Debilidades</span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{a.weaknesses}</p>
                </div>
              )}
              {a.threats && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <span className="inline-block bg-gray-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Amenazas</span>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{a.threats}</p>
                </div>
              )}
            </div>
            {a.publication_analysis && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-700 mb-1">An&aacute;lisis de publicaci&oacute;n actual</p>
                <p className="text-sm text-orange-800 whitespace-pre-wrap">{a.publication_analysis}</p>
              </div>
            )}
          </section>
        )}

        {/* Comparables */}
        {comparables.length > 0 && (
          <section className={`${cardClass} p-4 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
              <Eye className="w-5 h-5 text-indigo-500" /> Competencia en la zona
            </h2>
            <div className="space-y-4">
              {comparables.map((c: any, i: number) => (
                <div key={i} className={`${presentationMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-100'} border rounded-2xl overflow-hidden`}>
                  {c.photo_url && (
                    <img src={c.photo_url} alt={c.address || ''} className="w-full h-40 sm:h-52 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className={`font-bold text-base ${headingClass}`}>{c.address || `Propiedad ${i + 1}`}</p>
                        {c.price && (
                          <p className="text-lg font-bold text-[#ff007c] mt-0.5">USD {Number(c.price).toLocaleString('es-AR')}</p>
                        )}
                      </div>
                      {c.zonaprop_url && (
                        <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex-shrink-0">
                          Ver aviso &rarr;
                        </a>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {c.total_area && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">Total</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{c.total_area} m&sup2;</p>
                        </div>
                      )}
                      {c.covered_area && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">Cubierto</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{c.covered_area} m&sup2;</p>
                        </div>
                      )}
                      {c.usd_per_m2 && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">USD/m&sup2;</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{Number(c.usd_per_m2).toLocaleString('es-AR')}</p>
                        </div>
                      )}
                      {c.days_on_market && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">D&iacute;as</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{c.days_on_market}</p>
                        </div>
                      )}
                      {c.views_per_day && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">Vistas 30d</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{c.views_per_day}</p>
                        </div>
                      )}
                      {c.age && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">Antig.</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{c.age} a&ntilde;os</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sold properties */}
        {soldProps.length > 0 && (
          <section className={`${cardClass} p-4 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-2 flex items-center gap-2`}>
              <DollarSign className="w-5 h-5 text-green-500" /> Propiedades vendidas en la zona
            </h2>
            <div className="space-y-3">
              {soldProps.map((sp: any) => {
                const discount = sp.original_price && sp.sold_price
                  ? ((1 - sp.sold_price / sp.original_price) * 100).toFixed(1)
                  : null
                const usdM2Sold = sp.sold_price && sp.total_area
                  ? Math.round(sp.sold_price / sp.total_area)
                  : null
                return (
                  <div key={sp.id} className={`${presentationMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-100'} border rounded-xl p-4`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className={`font-bold text-sm ${headingClass}`}>{sp.address}</p>
                        <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {sp.neighborhood} &middot; {sp.property_type || 'Depto'} &middot; {sp.total_area ? `${sp.total_area} m\u00B2` : ''}
                          {sp.sold_date ? ` \u00B7 ${new Date(sp.sold_date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                      {discount && Number(discount) > 0 && (
                        <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-lg flex-shrink-0">
                          -{discount}%
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {sp.original_price && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">Publicado</p>
                          <p className={`text-sm font-semibold ${presentationMode ? 'text-gray-300 line-through' : 'text-gray-400 line-through'}`}>
                            USD {Number(sp.original_price).toLocaleString('es-AR')}
                          </p>
                        </div>
                      )}
                      <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                        <p className="text-[10px] text-gray-400">Cierre</p>
                        <p className="text-sm font-bold text-green-600">
                          USD {Number(sp.sold_price).toLocaleString('es-AR')}
                        </p>
                      </div>
                      {usdM2Sold && (
                        <div className={`${presentationMode ? 'bg-gray-600' : 'bg-white'} rounded-lg p-2 text-center`}>
                          <p className="text-[10px] text-gray-400">USD/m&sup2;</p>
                          <p className={`text-sm font-semibold ${headingClass}`}>{usdM2Sold.toLocaleString('es-AR')}</p>
                        </div>
                      )}
                    </div>
                    {sp.listing_url && (
                      <a href={sp.listing_url} target="_blank" rel="noopener noreferrer"
                        className={`text-xs mt-2 inline-flex items-center gap-1 ${presentationMode ? 'text-pink-400' : 'text-pink-600'} hover:underline`}>
                        Ver ficha →
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Valuation — Timeline style like brand presentations */}
        <section className="bg-[#f8f8f8] rounded-2xl p-6 sm:p-12 border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-8 bg-gradient-to-b from-[#ff007c] to-[#ff8017] rounded-full" />
            <div>
              <p className="text-gray-400 text-xs font-medium tracking-widest uppercase">Resultado del an&aacute;lisis</p>
              <h2 className={`font-black text-gray-800 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                Tasaci&oacute;n proyectada
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Sup. ponderada</p>
              <p className={`font-black text-gray-800 ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{weighted.toFixed(1)}</p>
              <p className="text-gray-400 text-sm mt-1">m&sup2;</p>
            </div>
            <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">USD/m&sup2;</p>
              <p className={`font-black text-gray-800 ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{usdM2.toLocaleString('es-AR')}</p>
              <p className="text-gray-400 text-sm mt-1">d&oacute;lares</p>
            </div>
          </div>
            {/* Timeline vertical with dots — like image 14 */}
            <div className="relative pl-8 sm:pl-10 space-y-4">
              {/* Timeline line */}
              <div className="absolute left-3 sm:left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-[#ff8017] via-[#ff007c] to-green-500" />

              {a.test_price && (
                <div className="relative">
                  <div className="absolute left-[-22px] sm:left-[-26px] top-5 w-3 h-3 rounded-full bg-[#ff8017] ring-4 ring-[#f8f8f8]" />
                  <div className="bg-white rounded-2xl p-5 sm:p-6 flex items-center justify-between border border-gray-100 shadow-sm">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Valor de prueba</p>
                      <p className="text-gray-500 text-sm">30 d&iacute;as</p>
                    </div>
                    <p className={`font-black text-gray-800 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>USD {Number(a.test_price).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )}
              {a.suggested_price && (
                <div className="relative">
                  <div className="absolute left-[-22px] sm:left-[-26px] top-6 w-3.5 h-3.5 rounded-full bg-[#ff007c] ring-4 ring-[#f8f8f8]" />
                  <div className="bg-white rounded-2xl p-6 sm:p-8 flex items-center justify-between border-2 border-[#ff007c]/20 shadow-md">
                    <div>
                      <p className="text-sm font-bold text-[#ff007c] uppercase tracking-wider">Valor sugerido</p>
                      <p className="text-xs text-gray-400">Publicaci&oacute;n inicial</p>
                    </div>
                    <p className={`font-black bg-gradient-to-r from-[#ff007c] to-[#ff8017] bg-clip-text text-transparent ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>USD {Number(a.suggested_price).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )}
              {a.expected_close_price && (
                <div className="relative">
                  <div className="absolute left-[-22px] sm:left-[-26px] top-5 w-3 h-3 rounded-full bg-green-500 ring-4 ring-[#f8f8f8]" />
                  <div className="bg-white rounded-2xl p-5 sm:p-6 flex items-center justify-between border border-gray-100 shadow-sm">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cierre esperado</p>
                      <p className="text-gray-500 text-sm">120 d&iacute;as</p>
                    </div>
                    <p className={`font-black text-green-600 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>USD {Number(a.expected_close_price).toLocaleString('es-AR')}</p>
                  </div>
                </div>
              )}
            </div>
        </section>

        {/* ====== SECTION 3: CTA ====== */}

        {settings.tasacion_texto_condiciones && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg font-semibold ${headingClass} mb-3`}>Condiciones de trabajo</h2>
            <p className={`${textClass} text-sm leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_condiciones}</p>
          </section>
        )}

        <section className="relative bg-[#f8f8f8] rounded-2xl p-8 sm:p-16 text-center border border-gray-100">
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-t-2xl" />
          <div className="relative">
            <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mb-3">Siguiente paso</p>
            <h2 className={`font-black text-gray-800 mb-4 ${presentationMode ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
              &iquest;Listo para vender al mejor precio?
            </h2>
            <p className={`text-gray-500 mb-10 max-w-lg mx-auto ${presentationMode ? 'text-lg' : 'text-sm sm:text-base'}`}>
              Si est&aacute;s dispuesto a vender con esta estrategia, coordinemos una reuni&oacute;n para aclarar todas las dudas.
            </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {calendlyUrl && (
              <a href={calendlyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:opacity-90 shadow-lg shadow-pink-200 w-full sm:w-auto justify-center">
                <Video className="w-5 h-5" /> Agendar reuni&oacute;n
              </a>
            )}
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, vi la tasación de ${a.property_address} y me gustaría coordinar.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-green-600 shadow-lg shadow-green-200 w-full sm:w-auto justify-center">
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
            {a.agent_phone && (
              <a href={`tel:${a.agent_phone}`} className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-50 w-full sm:w-auto justify-center">
                <Phone className="w-5 h-5" /> Llamar
              </a>
            )}
          </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <img src="/logo.png" alt="Marcela Genta" className="h-10 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">Marcela Genta &middot; Operaciones Inmobiliarias</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-gray-400 text-xs">
            <span>{a.agent_name}</span>
            {a.agent_phone && <span>&middot; <span className="text-[#ff007c]">{a.agent_phone}</span></span>}
            {a.agent_email && <span>&middot; {a.agent_email}</span>}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-gray-300 text-[10px] tracking-wider uppercase">CUCICBA Mat. N&deg;3906</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
