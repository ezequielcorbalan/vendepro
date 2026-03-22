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
    : 'min-h-screen bg-gray-50'
  const cardClass = presentationMode
    ? 'bg-gray-800 rounded-2xl shadow-lg text-white'
    : 'bg-white rounded-2xl shadow-sm'
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

      {/* Hero */}
      <header className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] text-white">
        <div className={`max-w-5xl mx-auto px-4 sm:px-8 ${presentationMode ? 'py-16 sm:py-24' : 'py-10 sm:py-16'}`}>
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Marcela Genta" className={`brightness-0 invert ${presentationMode ? 'h-12 sm:h-16' : 'h-8 sm:h-12'}`} />
            <span className={`text-white/80 font-medium ${presentationMode ? 'text-base' : 'text-sm'}`}>Operaciones Inmobiliarias</span>
          </div>
          <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase mb-2">Propuesta de tasaci&oacute;n</p>
          <h1 className={`font-bold leading-tight mb-2 ${presentationMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'}`}>{a.property_address}</h1>
          <p className={`text-white/80 ${presentationMode ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>{a.neighborhood}, {a.city}</p>
          <div className="mt-6 flex items-center gap-3">
            {a.agent_photo ? (
              <img src={a.agent_photo} alt={a.agent_name} className={`rounded-full object-cover ${presentationMode ? 'w-14 h-14' : 'w-10 h-10'}`} />
            ) : (
              <div className={`rounded-full bg-white/20 flex items-center justify-center font-bold ${presentationMode ? 'w-14 h-14 text-xl' : 'w-10 h-10'}`}>
                {(a.agent_name || 'A').charAt(0)}
              </div>
            )}
            <div>
              <p className={`font-semibold ${presentationMode ? 'text-base' : 'text-sm'}`}>{a.agent_name}</p>
              <p className={`text-white/70 ${presentationMode ? 'text-sm' : 'text-xs'}`}>{a.agent_phone}</p>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-8 ${presentationMode ? 'text-lg' : ''}`}>

        {/* ====== SECTION 1: PARTE COMERCIAL ====== */}

        {settings.tasacion_video_comercial && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="aspect-video">
              <iframe src={youtubeEmbed(settings.tasacion_video_comercial)!} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            {settings.tasacion_texto_comercial && (
              <div className="p-5 sm:p-8">
                <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
                  <span className="w-1 h-6 bg-[#ff007c] rounded-full" />
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
              <span className="w-1 h-6 bg-[#ff8017] rounded-full" />
              Qu&eacute; hacemos para vender al mejor valor
            </h2>
            <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_servicios}</p>
          </section>
        )}

        {(settings.tasacion_datos_props_publicadas || settings.tasacion_datos_escrituras_mes) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
              <span className="w-1 h-6 bg-indigo-500 rounded-full" />
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
                <div className={`${presentationMode ? 'bg-indigo-900/50' : 'bg-indigo-50'} rounded-xl p-5 text-center`}>
                  <Home className={`w-6 h-6 ${presentationMode ? 'text-indigo-300' : 'text-indigo-500'} mx-auto mb-2`} />
                  <p className={`text-3xl font-bold ${headingClass}`}>{Number(settings.tasacion_datos_props_publicadas).toLocaleString('es-AR')}</p>
                  <p className={`text-sm ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Propiedades en venta</p>
                </div>
              )}
              {settings.tasacion_datos_vendidas_mes && settings.tasacion_datos_props_publicadas && (
                <div className={`${presentationMode ? 'bg-green-900/50' : 'bg-green-50'} rounded-xl p-5 text-center`}>
                  <TrendingUp className={`w-6 h-6 ${presentationMode ? 'text-green-300' : 'text-green-500'} mx-auto mb-2`} />
                  <p className={`text-3xl font-bold ${headingClass}`}>
                    {(Number(settings.tasacion_datos_vendidas_mes) / Number(settings.tasacion_datos_props_publicadas) * 100).toFixed(1)}%
                  </p>
                  <p className={`text-sm ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Se vende por mes ({Number(settings.tasacion_datos_vendidas_mes).toLocaleString('es-AR')})</p>
                </div>
              )}
              {settings.tasacion_datos_escrituras_mes && (
                <div className={`${presentationMode ? 'bg-orange-900/50' : 'bg-orange-50'} rounded-xl p-5 text-center`}>
                  <Calendar className={`w-6 h-6 ${presentationMode ? 'text-orange-300' : 'text-orange-500'} mx-auto mb-2`} />
                  <p className={`text-3xl font-bold ${headingClass}`}>{Number(settings.tasacion_datos_escrituras_mes).toLocaleString('es-AR')}</p>
                  <p className={`text-sm ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Escrituras por mes</p>
                </div>
              )}
            </div>
          </section>
        )}

        {settings.tasacion_texto_embudo && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-6 bg-green-500 rounded-full" />
              Embudo de ventas y seguimiento
            </h2>
            <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{settings.tasacion_texto_embudo}</p>
            {settings.tasacion_texto_reportes && (
              <p className={`${textClass} text-sm sm:text-base leading-relaxed whitespace-pre-wrap mt-4 pt-4 border-t ${presentationMode ? 'border-gray-700' : 'border-gray-100'}`}>{settings.tasacion_texto_reportes}</p>
            )}
          </section>
        )}

        {/* ====== DIVIDER ====== */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><div className={`w-full border-t-2 ${presentationMode ? 'border-[#ff007c]/40' : 'border-[#ff007c]/20'}`} /></div>
          <div className="relative flex justify-center">
            <span className={`px-6 text-sm font-semibold text-[#ff007c] uppercase tracking-wider ${presentationMode ? 'bg-gray-900' : 'bg-gray-50'}`}>Tasaci&oacute;n de tu propiedad</span>
          </div>
        </div>

        {/* ====== SECTION 2: TASACIÓN VARIABLE ====== */}

        {/* Agent notes / explanation */}
        {a.agent_notes && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-6 bg-purple-500 rounded-full" />
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
          <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
            <Ruler className="w-5 h-5 text-[#ff007c]" />
            Datos de la propiedad
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`${presentationMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 text-center`}>
              <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Tipolog&iacute;a</p>
              <p className={`font-bold text-sm sm:text-base ${headingClass} capitalize`}>{a.property_type}</p>
            </div>
            <div className={`${presentationMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 text-center`}>
              <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Sup. cubierta</p>
              <p className={`font-bold text-sm sm:text-base ${headingClass}`}>{a.covered_area || '-'} m&sup2;</p>
            </div>
            <div className={`${presentationMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-xl p-4 text-center`}>
              <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Sup. total</p>
              <p className={`font-bold text-sm sm:text-base ${headingClass}`}>{a.total_area || '-'} m&sup2;</p>
            </div>
            <div className="bg-[#ff007c]/10 border border-[#ff007c]/20 rounded-xl p-4 text-center">
              <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Ponderada</p>
              <p className="font-bold text-sm sm:text-base text-[#ff007c]">{weighted.toFixed(1)} m&sup2;</p>
            </div>
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
                <div className={`${presentationMode ? 'bg-indigo-900/30 border-indigo-700' : 'bg-indigo-50 border-indigo-100'} border rounded-xl p-5 text-center`}>
                  <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>Precio promedio</p>
                  <p className={`text-2xl font-bold ${headingClass}`}>USD {Number(a.zone_avg_price).toLocaleString('es-AR')}</p>
                </div>
              )}
              {a.zone_avg_m2 && (
                <div className={`${presentationMode ? 'bg-indigo-900/30 border-indigo-700' : 'bg-indigo-50 border-indigo-100'} border rounded-xl p-5 text-center`}>
                  <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>m&sup2; promedio</p>
                  <p className={`text-2xl font-bold ${headingClass}`}>{Number(a.zone_avg_m2).toLocaleString('es-AR')} m&sup2;</p>
                </div>
              )}
              {a.zone_avg_usd_m2 && (
                <div className={`${presentationMode ? 'bg-[#ff007c]/10 border-[#ff007c]/30' : 'bg-[#ff007c]/5 border-[#ff007c]/15'} border rounded-xl p-5 text-center`}>
                  <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>USD/m&sup2; promedio</p>
                  <p className="text-2xl font-bold text-[#ff007c]">{Number(a.zone_avg_usd_m2).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FODA */}
        {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-4 flex items-center gap-2`}>
              <Shield className="w-5 h-5 text-indigo-500" /> An&aacute;lisis FODA
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {a.strengths && <div className="bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-xs font-semibold text-green-700 mb-1">Fortalezas</p><p className="text-sm text-green-800 whitespace-pre-wrap">{a.strengths}</p></div>}
              {a.weaknesses && <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-xs font-semibold text-red-700 mb-1">Debilidades</p><p className="text-sm text-red-800 whitespace-pre-wrap">{a.weaknesses}</p></div>}
              {a.opportunities && <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><p className="text-xs font-semibold text-blue-700 mb-1">Oportunidades</p><p className="text-sm text-blue-800 whitespace-pre-wrap">{a.opportunities}</p></div>}
              {a.threats && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><p className="text-xs font-semibold text-yellow-700 mb-1">Amenazas</p><p className="text-sm text-yellow-800 whitespace-pre-wrap">{a.threats}</p></div>}
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
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Valuation */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 sm:p-10 text-white shadow-lg">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#ff007c]" />
            Tasaci&oacute;n proyectada
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-5 text-center">
              <p className="text-xs text-white/60">Sup. ponderada</p>
              <p className={`font-bold ${presentationMode ? 'text-4xl' : 'text-2xl sm:text-3xl'}`}>{weighted.toFixed(1)} m&sup2;</p>
            </div>
            <div className="bg-white/10 rounded-xl p-5 text-center">
              <p className="text-xs text-white/60">USD/m&sup2;</p>
              <p className={`font-bold ${presentationMode ? 'text-4xl' : 'text-2xl sm:text-3xl'}`}>{usdM2.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {a.test_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
                <div><p className="text-sm text-white/60">Valor prueba (30 d&iacute;as)</p></div>
                <p className={`font-bold text-yellow-400 ${presentationMode ? 'text-3xl' : 'text-xl sm:text-2xl'}`}>USD {Number(a.test_price).toLocaleString('es-AR')}</p>
              </div>
            )}
            {a.suggested_price && (
              <div className="bg-[#ff007c]/20 border border-[#ff007c]/30 rounded-xl p-5 flex items-center justify-between">
                <div><p className="text-sm text-white/80 font-semibold">Valor sugerido</p></div>
                <p className={`font-bold text-[#ff007c] ${presentationMode ? 'text-4xl' : 'text-2xl sm:text-3xl'}`}>USD {Number(a.suggested_price).toLocaleString('es-AR')}</p>
              </div>
            )}
            {a.expected_close_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between">
                <div><p className="text-sm text-white/60">Cierre esperado (120 d&iacute;as)</p></div>
                <p className={`font-bold text-green-400 ${presentationMode ? 'text-3xl' : 'text-xl sm:text-2xl'}`}>USD {Number(a.expected_close_price).toLocaleString('es-AR')}</p>
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

        <section className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] rounded-2xl p-6 sm:p-12 text-white text-center">
          <h2 className={`font-bold mb-3 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
            &iquest;Listo para vender al mejor precio?
          </h2>
          <p className={`text-white/80 mb-8 max-w-lg mx-auto ${presentationMode ? 'text-lg' : 'text-sm sm:text-base'}`}>
            Si est&aacute;s dispuesto a vender con esta estrategia, coordinemos una reuni&oacute;n para aclarar todas las dudas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {calendlyUrl && (
              <a href={calendlyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white text-[#ff007c] px-6 py-3 rounded-full font-semibold text-sm hover:bg-gray-100 w-full sm:w-auto justify-center">
                <Video className="w-5 h-5" /> Agendar reuni&oacute;n
              </a>
            )}
            <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, vi la tasación de ${a.property_address} y me gustaría coordinar.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-green-600 w-full sm:w-auto justify-center">
              <MessageCircle className="w-5 h-5" /> WhatsApp
            </a>
            {a.agent_phone && (
              <a href={`tel:${a.agent_phone}`} className="inline-flex items-center gap-2 bg-white/20 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-white/30 w-full sm:w-auto justify-center">
                <Phone className="w-5 h-5" /> Llamar
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className={`${presentationMode ? 'bg-black' : 'bg-gray-900'} text-white py-8`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <img src="/logo.png" alt="Marcela Genta" className="h-8 mx-auto mb-3 brightness-0 invert" />
          <p className="text-gray-400 text-sm">Marcela Genta &middot; Operaciones Inmobiliarias</p>
          <p className="text-gray-500 text-xs mt-1">{a.agent_name} &middot; {a.agent_phone} &middot; {a.agent_email}</p>
          <p className="text-gray-600 text-[10px] mt-3">CUCICBA Mat. N&deg;3906</p>
        </div>
      </footer>
    </div>
  )
}
