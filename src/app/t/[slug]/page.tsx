import { getDB } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Ruler, TrendingUp, Calendar, Phone, Video, MessageCircle, Home, Monitor, BarChart3 } from 'lucide-react'
import BlockRenderer from '@/components/tasacion/BlockRenderer'

function youtubeEmbed(url: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  if (url.includes('youtube-nocookie.com')) return url
  return url
}

async function getOrgSettings(orgId: string) {
  const db = await getDB()
  const settings = (await db.prepare(
    'SELECT setting_key, setting_value FROM org_settings WHERE org_id = ?'
  ).bind(orgId).all()).results as any[]
  const result: Record<string, string> = {}
  for (const s of settings) result[s.setting_key] = s.setting_value
  return result
}

async function getOrgBranding(orgId: string) {
  const db = await getDB()
  const org = await db.prepare(
    'SELECT name, slug, logo_url, brand_color, brand_accent_color FROM organizations WHERE id = ?'
  ).bind(orgId).first() as any
  return {
    name: org?.name || 'Inmobiliaria',
    logo_url: org?.logo_url || '/logo.png',
    primary: org?.brand_color || '#ff007c',
    accent: org?.brand_accent_color || '#ff8017',
  }
}

async function getTemplateBlocks(orgId: string) {
  const db = await getDB()
  try {
    return (await db.prepare(
      'SELECT * FROM tasacion_template_blocks WHERE org_id = ? AND enabled = 1 ORDER BY sort_order'
    ).bind(orgId).all()).results as any[]
  } catch { return [] }
}

async function getSoldProperties(appraisalId: string, neighborhood: string) {
  const db = await getDB()
  let results = (await db.prepare(
    `SELECT sp.* FROM sold_properties sp
     INNER JOIN appraisal_sold_properties asp ON sp.id = asp.sold_property_id
     WHERE asp.appraisal_id = ? ORDER BY sp.sold_date DESC`
  ).bind(appraisalId).all()).results as any[]
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

  const orgId = appraisal.org_id || 'org_mg'
  const settings = await getOrgSettings(orgId)
  const brand = await getOrgBranding(orgId)
  const blocks = await getTemplateBlocks(orgId)
  const soldProps = await getSoldProperties(appraisal.id, appraisal.neighborhood)

  // Agent-specific video overrides
  const agentVideos: Record<string, string> = {}
  try {
    const avRows = (await db.prepare(
      'SELECT setting_key, setting_value FROM agent_settings WHERE agent_id = ?'
    ).bind(appraisal.agent_id).all()).results as any[]
    for (const r of avRows) agentVideos[r.setting_key] = r.setting_value
  } catch { /* table may not exist */ }

  const a = appraisal
  const weighted = Number(a.weighted_area) || 0
  const usdM2 = Number(a.usd_per_m2) || 0
  const whatsapp = settings.tasacion_cta_whatsapp || '5491158905594'
  const calendlyUrl = settings.tasacion_cta_calendly || ''
  const { primary, accent } = brand

  // Inject agent video overrides into blocks
  const enrichedBlocks = blocks.map((block: any) => {
    if (block.id === 'blk_video_comercial' && agentVideos.video_propuesta_comercial) {
      return { ...block, video_url: agentVideos.video_propuesta_comercial }
    }
    if (block.id === 'blk_video_mercado' && agentVideos.video_situacion_mercado) {
      return { ...block, video_url: agentVideos.video_situacion_mercado }
    }
    return block
  })

  const commercialBlocks = enrichedBlocks.filter((b: any) => b.section === 'commercial')
  const conditionBlocks = enrichedBlocks.filter((b: any) => b.section === 'conditions')

  const containerClass = presentationMode ? 'min-h-screen bg-gray-900' : 'min-h-screen bg-white'
  const cardClass = presentationMode
    ? 'bg-gray-800/80 backdrop-blur rounded-2xl shadow-2xl border border-gray-700/50 text-white'
    : 'bg-[#f8f8f8] rounded-2xl border border-gray-100'
  const headingClass = presentationMode ? 'text-white' : 'text-gray-800'

  const gradientStyle = { background: `linear-gradient(to right, ${primary}, ${accent})` }
  const gradientVStyle = { background: `linear-gradient(to bottom, ${primary}, ${accent})` }

  return (
    <div className={containerClass}>
      {/* Presentation mode toggle */}
      {!presentationMode && (
        <a href={`/t/${slug}?modo=presentacion`} className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors" title="Modo presentación">
          <Monitor className="w-5 h-5" />
        </a>
      )}
      {presentationMode && (
        <a href={`/t/${slug}`} className="fixed bottom-4 right-4 z-50 bg-white text-gray-900 p-3 rounded-full shadow-lg hover:bg-gray-100 transition-colors" title="Volver a modo normal">
          <Monitor className="w-5 h-5" />
        </a>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden bg-white border-b border-gray-100">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 sm:w-2" style={gradientVStyle} />
        <div className={`max-w-5xl mx-auto px-6 sm:px-10 ${presentationMode ? 'py-20 sm:py-28' : 'py-10 sm:py-16'}`}>
          <div className="flex items-center gap-3 mb-6">
            <img src={brand.logo_url} alt={brand.name} className={`${presentationMode ? 'h-12 sm:h-16' : 'h-8 sm:h-12'}`} />
            <span className={`text-gray-400 font-medium ${presentationMode ? 'text-base' : 'text-sm'}`}>Operaciones Inmobiliarias</span>
          </div>
          <div className="inline-block rounded-full px-4 py-1.5 mb-4" style={gradientStyle}>
            <p className="text-white text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasación</p>
          </div>
          <h1 className={`font-black leading-tight mb-3 text-gray-800 ${presentationMode ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl'}`}>{a.property_address}</h1>
          <p className={`text-gray-400 font-light ${presentationMode ? 'text-lg sm:text-2xl' : 'text-lg sm:text-xl'}`}>{a.neighborhood}, {a.city}</p>

          {/* Agent card */}
          <div className="mt-8 inline-flex items-center gap-4 bg-[#f8f8f8] rounded-2xl px-5 py-3">
            {a.agent_photo ? (
              <img src={a.agent_photo} alt={a.agent_name} className={`rounded-full object-cover ring-2 ring-pink-200 ${presentationMode ? 'w-14 h-14' : 'w-11 h-11'}`} />
            ) : (
              <div className={`rounded-full flex items-center justify-center font-bold text-white ${presentationMode ? 'w-14 h-14 text-xl' : 'w-11 h-11'}`} style={gradientStyle}>
                {(a.agent_name || 'A').charAt(0)}
              </div>
            )}
            <div>
              <p className={`font-semibold text-gray-800 ${presentationMode ? 'text-base' : 'text-sm'}`}>{a.agent_name}</p>
              <p className={`${presentationMode ? 'text-sm' : 'text-xs'}`} style={{ color: primary }}>{a.agent_phone}</p>
            </div>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto px-4 sm:px-8 py-10 sm:py-14 space-y-8 sm:space-y-10 ${presentationMode ? 'text-lg' : ''}`}>

        {/* ====== ZONE A: COMMERCIAL BLOCKS (from template) ====== */}
        {commercialBlocks.map((block: any) => (
          <BlockRenderer
            key={block.id}
            block={block}
            settings={settings}
            primary={primary}
            accent={accent}
            cardClass={cardClass}
            presentationMode={presentationMode}
          />
        ))}

        {/* ====== DIVIDER ====== */}
        <div className="relative py-8">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full h-px ${presentationMode ? 'opacity-40' : 'opacity-20'}`} style={{ background: `linear-gradient(to right, transparent, ${primary}, transparent)` }} />
          </div>
          <div className="relative flex justify-center">
            <span className={`px-8 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${presentationMode ? 'bg-gray-900' : 'bg-white shadow-sm border border-pink-100 rounded-full'}`} style={{ color: primary }}>
              Tasación de tu propiedad
            </span>
          </div>
        </div>

        {/* ====== ZONE B: PER-APPRAISAL DATA ====== */}

        {/* Agent notes */}
        {a.agent_notes && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-3 flex items-center gap-2`}>
              <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
              Explicación de la tasación
            </h2>
            <p className={`${presentationMode ? 'text-gray-300' : 'text-gray-600'} text-sm sm:text-base leading-relaxed whitespace-pre-wrap`}>{a.agent_notes}</p>
          </section>
        )}

        {/* Tasacion video */}
        {(a.video_tasacion_url || a.video_url) && (
          <section className={`${cardClass} overflow-hidden`}>
            <div className="p-5 pb-0">
              <h2 className={`text-lg font-semibold ${headingClass} flex items-center gap-2`}>
                <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
                Video: Explicación de la tasación
              </h2>
            </div>
            <div className="aspect-video p-5">
              <iframe src={youtubeEmbed(a.video_tasacion_url || a.video_url)!} className="w-full h-full rounded-xl" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </section>
        )}

        {/* Property data */}
        <section className={`${cardClass} p-5 sm:p-8`}>
          <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
            <Ruler className="w-5 h-5" style={{ color: primary }} />
            Datos de la propiedad
          </h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Tipología</p>
                <p className={`font-black text-lg ${headingClass} capitalize`}>{a.property_type}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Cubierta</p>
                <p className={`font-black text-lg ${headingClass}`}>{a.covered_area || '-'} <span className="text-sm font-normal text-gray-400">m²</span></p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total</p>
                <p className={`font-black text-lg ${headingClass}`}>{a.total_area || '-'} <span className="text-sm font-normal text-gray-400">m²</span></p>
              </div>
              <div className="p-4 text-center" style={{ background: `linear-gradient(135deg, ${primary}08, ${accent}08)` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: primary }}>Ponderada</p>
                <p className="font-black text-lg" style={{ color: primary }}>{weighted.toFixed(1)} <span className="text-sm font-normal">m²</span></p>
              </div>
            </div>
            {(a.semi_area || a.total_area !== a.covered_area) && (
              <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
                {a.semi_area && <span>Semicubierta: {a.semi_area} m²</span>}
                {a.total_area && a.covered_area && Number(a.total_area) !== Number(a.covered_area) && (
                  <span>Descubierta: {(Number(a.total_area) - Number(a.covered_area) - (Number(a.semi_area) || 0)).toFixed(0)} m²</span>
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
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">m² promedio</p>
                  <p className={`font-black text-gray-800 ${presentationMode ? 'text-3xl' : 'text-2xl'}`}>{Number(a.zone_avg_m2).toLocaleString('es-AR')}</p>
                </div>
              )}
              {a.zone_avg_usd_m2 && (
                <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center shadow-sm">
                  <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: primary }}>USD/m²</p>
                  <p className={`font-black ${presentationMode ? 'text-3xl' : 'text-2xl'}`} style={{ color: primary }}>{Number(a.zone_avg_usd_m2).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* FODA */}
        {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
          <section className={`${cardClass} p-5 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
              <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
              Análisis FODA
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {a.strengths && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex">
                  <div className="w-1 flex-shrink-0" style={gradientVStyle} />
                  <div className="p-5">
                    <span className="inline-block text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3" style={gradientStyle}>Fortalezas</span>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{a.strengths}</p>
                  </div>
                </div>
              )}
              {a.opportunities && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex">
                  <div className="w-1 flex-shrink-0" style={{ background: `linear-gradient(to bottom, ${accent}, #ffb347)` }} />
                  <div className="p-5">
                    <span className="inline-block text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3" style={{ background: `linear-gradient(to right, ${accent}, #ffb347)` }}>Oportunidades</span>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{a.opportunities}</p>
                  </div>
                </div>
              )}
              {a.weaknesses && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex">
                  <div className="w-1 bg-gray-300 flex-shrink-0" />
                  <div className="p-5">
                    <span className="inline-block bg-gray-400 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Debilidades</span>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{a.weaknesses}</p>
                  </div>
                </div>
              )}
              {a.threats && (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex">
                  <div className="w-1 bg-gray-500 flex-shrink-0" />
                  <div className="p-5">
                    <span className="inline-block bg-gray-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">Amenazas</span>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">{a.threats}</p>
                  </div>
                </div>
              )}
            </div>
            {a.publication_analysis && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-700 mb-1">Análisis de publicación actual</p>
                <p className="text-sm text-orange-800 whitespace-pre-wrap">{a.publication_analysis}</p>
              </div>
            )}
          </section>
        )}

        {/* Comparables */}
        {comparables.length > 0 && (
          <section className={`${cardClass} p-4 sm:p-8`}>
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
              <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
              Competencia en la zona
              <span className="ml-auto text-xs font-normal text-gray-400">{comparables.length} propiedades</span>
            </h2>
            <div className="space-y-4">
              {comparables.map((c: any, i: number) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row">
                    {c.photo_url && (
                      <div className="sm:w-56 sm:flex-shrink-0">
                        <img src={c.photo_url} alt={c.address || ''} className="w-full h-40 sm:h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="font-bold text-base text-gray-800">{c.address || `Comparable ${i + 1}`}</p>
                          {c.price && (
                            <p className="text-xl font-black mt-0.5" style={{ color: primary }}>USD {Number(c.price).toLocaleString('es-AR')}</p>
                          )}
                        </div>
                        {c.zonaprop_url && (
                          <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-white px-3 py-1.5 rounded-full hover:opacity-90 flex-shrink-0 font-medium" style={gradientStyle}>
                            Ver aviso →
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {c.covered_area && (
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400 uppercase">Cubierto</p>
                            <p className="text-sm font-bold text-gray-700">{c.covered_area} m²</p>
                          </div>
                        )}
                        {c.total_area && (
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400 uppercase">Total</p>
                            <p className="text-sm font-bold text-gray-700">{c.total_area} m²</p>
                          </div>
                        )}
                        {c.usd_per_m2 && (
                          <div className="rounded-lg p-2 text-center" style={{ background: `${primary}0D` }}>
                            <p className="text-[9px] uppercase font-medium" style={{ color: primary }}>USD/m²</p>
                            <p className="text-sm font-bold" style={{ color: primary }}>{Number(c.usd_per_m2).toLocaleString('es-AR')}</p>
                          </div>
                        )}
                        {c.days_on_market && (
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400 uppercase">Días</p>
                            <p className="text-sm font-bold text-gray-700">{c.days_on_market}</p>
                          </div>
                        )}
                        {c.views_per_day && (
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400 uppercase">Vistas</p>
                            <p className="text-sm font-bold text-gray-700">{c.views_per_day}</p>
                          </div>
                        )}
                        {c.age && (
                          <div className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400 uppercase">Antig.</p>
                            <p className="text-sm font-bold text-gray-700">{c.age} años</p>
                          </div>
                        )}
                      </div>
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
            <h2 className={`text-lg sm:text-xl font-semibold ${headingClass} mb-5 flex items-center gap-2`}>
              <span className="w-1 h-7 rounded-full" style={gradientVStyle} />
              Propiedades vendidas en la zona
              <span className="ml-auto text-xs font-normal text-gray-400">{soldProps.length} operaciones</span>
            </h2>
            <div className="space-y-3">
              {soldProps.map((sold: any) => {
                const discount = sold.original_price && sold.sold_price
                  ? ((1 - sold.sold_price / sold.original_price) * 100).toFixed(1)
                  : null
                const usdM2Sold = sold.sold_price && sold.total_area
                  ? Math.round(sold.sold_price / sold.total_area)
                  : null
                return (
                  <div key={sold.id} className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 truncate">{sold.address}</p>
                        <p className={`text-xs ${presentationMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {sold.neighborhood} · {sold.property_type || 'Depto'} · {sold.total_area ? `${sold.total_area} m²` : ''}
                          {sold.sold_date ? ` · ${new Date(sold.sold_date).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                      {discount && Number(discount) > 0 && (
                        <span className="text-[10px] font-bold bg-red-50 text-red-500 px-2 py-1 rounded-full border border-red-100 flex-shrink-0">-{discount}%</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {sold.original_price && (
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-[9px] text-gray-400 uppercase">Publicado</p>
                          <p className="text-sm font-semibold text-gray-400 line-through">USD {Number(sold.original_price).toLocaleString('es-AR')}</p>
                        </div>
                      )}
                      <div className="bg-green-50 rounded-lg p-2.5 text-center border border-green-100">
                        <p className="text-[9px] text-green-600 uppercase font-medium">Cierre</p>
                        <p className="text-sm font-black text-green-600">USD {Number(sold.sold_price).toLocaleString('es-AR')}</p>
                      </div>
                      {usdM2Sold && (
                        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-[9px] text-gray-400 uppercase">USD/m²</p>
                          <p className="text-sm font-bold text-gray-700">{usdM2Sold.toLocaleString('es-AR')}</p>
                        </div>
                      )}
                    </div>
                    {sold.listing_url && (
                      <a href={sold.listing_url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] mt-2 inline-flex items-center gap-1 text-white px-2.5 py-1 rounded-full hover:opacity-90 font-medium" style={gradientStyle}>
                        Ver ficha →
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Valuation timeline */}
        <section className="bg-[#f8f8f8] rounded-2xl p-6 sm:p-12 border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1.5 h-8 rounded-full" style={gradientVStyle} />
            <div>
              <p className="text-gray-400 text-xs font-medium tracking-widest uppercase">Resultado del análisis</p>
              <h2 className={`font-black text-gray-800 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>Tasación proyectada</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Sup. ponderada</p>
              <p className={`font-black text-gray-800 ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{weighted.toFixed(1)}</p>
              <p className="text-gray-400 text-sm mt-1">m²</p>
            </div>
            <div className="bg-white rounded-2xl p-5 sm:p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">USD/m²</p>
              <p className={`font-black text-gray-800 ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{usdM2.toLocaleString('es-AR')}</p>
              <p className="text-gray-400 text-sm mt-1">dólares</p>
            </div>
          </div>
          <div className="relative pl-8 sm:pl-10 space-y-4">
            <div className="absolute left-3 sm:left-4 top-4 bottom-4 w-0.5" style={{ background: `linear-gradient(to bottom, ${accent}, ${primary}, #22c55e)` }} />
            {a.test_price && (
              <div className="relative">
                <div className="absolute left-[-22px] sm:left-[-26px] top-5 w-3 h-3 rounded-full ring-4 ring-[#f8f8f8]" style={{ background: accent }} />
                <div className="bg-white rounded-2xl p-5 sm:p-6 flex items-center justify-between border border-gray-100 shadow-sm">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Valor de prueba</p>
                    <p className="text-gray-500 text-sm">30 días</p>
                  </div>
                  <p className={`font-black text-gray-800 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>USD {Number(a.test_price).toLocaleString('es-AR')}</p>
                </div>
              </div>
            )}
            {a.suggested_price && (
              <div className="relative">
                <div className="absolute left-[-22px] sm:left-[-26px] top-6 w-3.5 h-3.5 rounded-full ring-4 ring-[#f8f8f8]" style={{ background: primary }} />
                <div className="bg-white rounded-2xl p-6 sm:p-8 flex items-center justify-between shadow-md" style={{ borderWidth: 2, borderColor: `${primary}33` }}>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider" style={{ color: primary }}>Valor sugerido</p>
                    <p className="text-xs text-gray-400">Publicación inicial</p>
                  </div>
                  <p className={`font-black bg-clip-text text-transparent ${presentationMode ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`} style={{ backgroundImage: `linear-gradient(to right, ${primary}, ${accent})` }}>
                    USD {Number(a.suggested_price).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>
            )}
            {a.expected_close_price && (
              <div className="relative">
                <div className="absolute left-[-22px] sm:left-[-26px] top-5 w-3 h-3 rounded-full bg-green-500 ring-4 ring-[#f8f8f8]" />
                <div className="bg-white rounded-2xl p-5 sm:p-6 flex items-center justify-between border border-gray-100 shadow-sm">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cierre esperado</p>
                    <p className="text-gray-500 text-sm">120 días</p>
                  </div>
                  <p className={`font-black text-green-600 ${presentationMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>USD {Number(a.expected_close_price).toLocaleString('es-AR')}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ====== CONDITIONS + CTA ====== */}

        {conditionBlocks.map((block: any) => (
          <BlockRenderer
            key={block.id}
            block={block}
            settings={settings}
            primary={primary}
            accent={accent}
            cardClass={cardClass}
            presentationMode={presentationMode}
          />
        ))}

        <section className="relative bg-[#f8f8f8] rounded-2xl p-8 sm:p-16 text-center border border-gray-100">
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl" style={gradientStyle} />
          <div className="relative">
            <p className="text-gray-400 text-xs font-medium tracking-widest uppercase mb-3">Siguiente paso</p>
            <h2 className={`font-black text-gray-800 mb-4 ${presentationMode ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
              ¿Listo para vender al mejor precio?
            </h2>
            <p className={`text-gray-500 mb-10 max-w-lg mx-auto ${presentationMode ? 'text-lg' : 'text-sm sm:text-base'}`}>
              Si estás dispuesto a vender con esta estrategia, coordinemos una reunión para aclarar todas las dudas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {calendlyUrl && (
                <a href={calendlyUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:opacity-90 shadow-lg w-full sm:w-auto justify-center"
                  style={{ ...gradientStyle, boxShadow: `0 10px 25px -5px ${primary}40` }}>
                  <Video className="w-5 h-5" /> Agendar reunión
                </a>
              )}
              <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, vi la tasación de ${a.property_address} y me gustaría coordinar.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-green-600 shadow-lg shadow-green-200 w-full sm:w-auto justify-center">
                <MessageCircle className="w-5 h-5" /> WhatsApp
              </a>
              {a.agent_phone && (
                <a href={`tel:${a.agent_phone}`}
                  className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-50 w-full sm:w-auto justify-center">
                  <Phone className="w-5 h-5" /> Llamar
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <img src={brand.logo_url} alt={brand.name} className="h-10 mx-auto mb-4" />
          <p className="text-gray-600 text-sm font-medium">{brand.name} · Operaciones Inmobiliarias</p>
          <div className="flex items-center justify-center gap-4 mt-3 text-gray-400 text-xs">
            <span>{a.agent_name}</span>
            {a.agent_phone && <span>· <span style={{ color: primary }}>{a.agent_phone}</span></span>}
            {a.agent_email && <span>· {a.agent_email}</span>}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-gray-300 text-[10px] tracking-wider uppercase">CUCICBA Mat. N°3906</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
