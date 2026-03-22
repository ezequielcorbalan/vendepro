import { getDB } from '@/lib/db'
import { notFound } from 'next/navigation'
import { MapPin, Ruler, Shield, TrendingUp, Calendar, DollarSign, Phone, Video, MessageCircle, ExternalLink, Home, Eye, Clock } from 'lucide-react'

async function getOrgSettings() {
  const db = await getDB()
  const settings = (await db.prepare(
    "SELECT setting_key, setting_value FROM org_settings WHERE org_id = 'org_mg'"
  ).all()).results as any[]
  const result: Record<string, string> = {}
  for (const s of settings) result[s.setting_key] = s.setting_value
  return result
}

async function getSoldProperties(neighborhood: string) {
  const db = await getDB()
  return (await db.prepare(
    'SELECT * FROM sold_properties WHERE neighborhood = ? ORDER BY sold_date DESC LIMIT 5'
  ).bind(neighborhood).all()).results as any[]
}

export default async function TasacionPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const db = await getDB()

  const appraisal = await db.prepare(`
    SELECT a.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id
    WHERE a.public_slug = ?
  `).bind(slug).first() as any

  if (!appraisal) notFound()

  const comparables = (await db.prepare(
    'SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order'
  ).bind(appraisal.id).all()).results as any[]

  const settings = await getOrgSettings()
  const soldProps = await getSoldProperties(appraisal.neighborhood)

  const a = appraisal
  const weighted = Number(a.weighted_area) || 0
  const usdM2 = Number(a.usd_per_m2) || 0
  const whatsapp = settings.tasacion_cta_whatsapp || '5491158905594'
  const calendlyUrl = settings.tasacion_cta_calendly || ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Marcela Genta" className="h-8 sm:h-12 brightness-0 invert" />
            <span className="text-white/80 text-sm font-medium">Operaciones Inmobiliarias</span>
          </div>
          <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase mb-2">Propuesta de tasaci&oacute;n</p>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-2">{a.property_address}</h1>
          <p className="text-white/80 text-base sm:text-lg">{a.neighborhood}, {a.city}</p>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
              {(a.agent_name || 'A').charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-sm">{a.agent_name}</p>
              <p className="text-white/70 text-xs">{a.agent_phone}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ============================================ */}
        {/* SECTION 1: PARTE COMERCIAL (NO VARIABLE) */}
        {/* ============================================ */}

        {/* Video propuesta comercial */}
        {settings.tasacion_video_comercial && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-video">
              <iframe
                src={settings.tasacion_video_comercial}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {settings.tasacion_texto_comercial && (
              <div className="p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-1 h-6 bg-[#ff007c] rounded-full" />
                  Nuestra propuesta comercial
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{settings.tasacion_texto_comercial}</p>
              </div>
            )}
          </section>
        )}

        {/* Servicios */}
        {settings.tasacion_texto_servicios && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#ff8017] rounded-full" />
              Qu&eacute; hacemos para vender al mejor valor
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{settings.tasacion_texto_servicios}</p>
          </section>
        )}

        {/* Datos mercado */}
        {(settings.tasacion_datos_props_publicadas || settings.tasacion_datos_escrituras_mes) && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-indigo-500 rounded-full" />
              Situaci&oacute;n del mercado
            </h2>
            {settings.tasacion_video_mercado && (
              <div className="aspect-video rounded-xl overflow-hidden mb-4">
                <iframe src={settings.tasacion_video_mercado} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {settings.tasacion_datos_props_publicadas && (
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <Home className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{Number(settings.tasacion_datos_props_publicadas).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Propiedades en venta</p>
                </div>
              )}
              {settings.tasacion_datos_props_vendidas_pct && (
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{settings.tasacion_datos_props_vendidas_pct}%</p>
                  <p className="text-xs text-gray-500">Se vende por mes</p>
                </div>
              )}
              {settings.tasacion_datos_escrituras_mes && (
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <Calendar className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-800">{Number(settings.tasacion_datos_escrituras_mes).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Escrituras por mes</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Embudo + Reportes */}
        {settings.tasacion_texto_embudo && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-green-500 rounded-full" />
              Embudo de ventas y seguimiento
            </h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{settings.tasacion_texto_embudo}</p>
            {settings.tasacion_texto_reportes && (
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap mt-4 pt-4 border-t border-gray-100">{settings.tasacion_texto_reportes}</p>
            )}
          </section>
        )}

        {/* ============================================ */}
        {/* SECTION 2: TASACIÓN (VARIABLE) */}
        {/* ============================================ */}

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-[#ff007c]/20" /></div>
          <div className="relative flex justify-center">
            <span className="bg-gray-50 px-4 text-sm font-semibold text-[#ff007c] uppercase tracking-wider">Tasaci&oacute;n de tu propiedad</span>
          </div>
        </div>

        {/* Video tasación */}
        {a.video_url && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-video">
              <iframe src={a.video_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          </section>
        )}

        {/* Datos propiedad */}
        <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-[#ff007c]" />
            Datos de la propiedad
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">Tipolog&iacute;a</p>
              <p className="font-bold text-sm capitalize">{a.property_type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">Sup. cubierta</p>
              <p className="font-bold text-sm">{a.covered_area || '-'} m&sup2;</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">Sup. total</p>
              <p className="font-bold text-sm">{a.total_area || '-'} m&sup2;</p>
            </div>
            <div className="bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-500">Ponderada</p>
              <p className="font-bold text-sm text-[#ff007c]">{weighted.toFixed(1)} m&sup2;</p>
            </div>
          </div>
        </section>

        {/* FODA */}
        {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-500" />
              An&aacute;lisis FODA
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {a.strengths && <div className="bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-xs font-semibold text-green-700 mb-1">Fortalezas</p><p className="text-xs text-green-800 whitespace-pre-wrap">{a.strengths}</p></div>}
              {a.weaknesses && <div className="bg-red-50 border border-red-200 rounded-xl p-4"><p className="text-xs font-semibold text-red-700 mb-1">Debilidades</p><p className="text-xs text-red-800 whitespace-pre-wrap">{a.weaknesses}</p></div>}
              {a.opportunities && <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><p className="text-xs font-semibold text-blue-700 mb-1">Oportunidades</p><p className="text-xs text-blue-800 whitespace-pre-wrap">{a.opportunities}</p></div>}
              {a.threats && <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><p className="text-xs font-semibold text-yellow-700 mb-1">Amenazas</p><p className="text-xs text-yellow-800 whitespace-pre-wrap">{a.threats}</p></div>}
            </div>
            {a.publication_analysis && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-700 mb-1">An&aacute;lisis de publicaci&oacute;n actual</p>
                <p className="text-xs text-orange-800 whitespace-pre-wrap">{a.publication_analysis}</p>
              </div>
            )}
          </section>
        )}

        {/* Comparables */}
        {comparables.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-500" />
              Competencia en la zona
            </h2>
            <div className="space-y-3">
              {comparables.map((c: any, i: number) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{c.address || 'Propiedad ' + (i + 1)}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {c.price && <span className="text-xs bg-[#ff007c]/10 text-[#ff007c] font-semibold px-2 py-0.5 rounded">USD {Number(c.price).toLocaleString('es-AR')}</span>}
                        {c.total_area && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.total_area} m&sup2;</span>}
                        {c.usd_per_m2 && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{Number(c.usd_per_m2).toLocaleString('es-AR')} USD/m&sup2;</span>}
                        {c.days_on_market && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"><Clock className="w-3 h-3 inline" /> {c.days_on_market}d</span>}
                        {c.views_per_day && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"><Eye className="w-3 h-3 inline" /> {c.views_per_day}/d</span>}
                      </div>
                    </div>
                    {c.zonaprop_url && (
                      <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-3 py-1.5 rounded-lg flex-shrink-0">
                        Ver aviso &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Props vendidas */}
        {soldProps.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Propiedades vendidas en la zona
            </h2>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-2 font-medium text-gray-500">Direcci&oacute;n</th>
                    <th className="text-center p-2 font-medium text-gray-500">Precio venta</th>
                    <th className="text-center p-2 font-medium text-gray-500">m&sup2;</th>
                    <th className="text-center p-2 font-medium text-gray-500">USD/m&sup2;</th>
                    <th className="text-center p-2 font-medium text-gray-500">D&iacute;as</th>
                  </tr>
                </thead>
                <tbody>
                  {soldProps.map((sp: any) => (
                    <tr key={sp.id} className="border-b border-gray-50">
                      <td className="p-2 font-medium">{sp.address}</td>
                      <td className="text-center p-2 text-green-600 font-semibold">{sp.sold_price ? `USD ${Number(sp.sold_price).toLocaleString('es-AR')}` : '-'}</td>
                      <td className="text-center p-2">{sp.total_area || '-'}</td>
                      <td className="text-center p-2">{sp.sold_price && sp.total_area ? Math.round(sp.sold_price / sp.total_area).toLocaleString('es-AR') : '-'}</td>
                      <td className="text-center p-2">{sp.days_on_market || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tasación proyectada */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 sm:p-8 text-white shadow-lg">
          <h2 className="text-lg sm:text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ff007c]" />
            Tasaci&oacute;n proyectada
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">Sup. ponderada</p>
              <p className="text-2xl font-bold">{weighted.toFixed(1)} m&sup2;</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">USD/m&sup2;</p>
              <p className="text-2xl font-bold">{usdM2.toLocaleString('es-AR')}</p>
            </div>
          </div>
          <div className="space-y-3">
            {a.test_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div><p className="text-xs text-white/60">Valor prueba (30 d&iacute;as)</p></div>
                <p className="text-xl font-bold text-yellow-400">USD {Number(a.test_price).toLocaleString('es-AR')}</p>
              </div>
            )}
            {a.suggested_price && (
              <div className="bg-[#ff007c]/20 border border-[#ff007c]/30 rounded-xl p-4 flex items-center justify-between">
                <div><p className="text-xs text-white/80 font-semibold">Valor sugerido</p></div>
                <p className="text-2xl sm:text-3xl font-bold text-[#ff007c]">USD {Number(a.suggested_price).toLocaleString('es-AR')}</p>
              </div>
            )}
            {a.expected_close_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div><p className="text-xs text-white/60">Cierre esperado (120 d&iacute;as)</p></div>
                <p className="text-xl font-bold text-green-400">USD {Number(a.expected_close_price).toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        </section>

        {/* ============================================ */}
        {/* SECTION 3: CALL TO ACTION */}
        {/* ============================================ */}

        {/* Condiciones */}
        {settings.tasacion_texto_condiciones && (
          <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Condiciones de trabajo</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{settings.tasacion_texto_condiciones}</p>
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] rounded-2xl p-6 sm:p-10 text-white text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-3">
            &iquest;Listo para vender al mejor precio?
          </h2>
          <p className="text-white/80 text-sm sm:text-base mb-6 max-w-lg mx-auto">
            Si est&aacute;s dispuesto a vender con esta estrategia, coordinemos una reuni&oacute;n para aclarar todas las dudas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {calendlyUrl && (
              <a
                href={calendlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-[#ff007c] px-6 py-3 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors w-full sm:w-auto justify-center"
              >
                <Video className="w-5 h-5" />
                Agendar reuni&oacute;n
              </a>
            )}
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, vi la tasación de ${a.property_address} y me gustaría coordinar una reunión.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-green-600 transition-colors w-full sm:w-auto justify-center"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </a>
            {a.agent_phone && (
              <a
                href={`tel:${a.agent_phone}`}
                className="inline-flex items-center gap-2 bg-white/20 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-white/30 transition-colors w-full sm:w-auto justify-center"
              >
                <Phone className="w-5 h-5" />
                Llamar
              </a>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <img src="/logo.png" alt="Marcela Genta" className="h-8 mx-auto mb-3 brightness-0 invert" />
          <p className="text-gray-400 text-sm">Marcela Genta &middot; Operaciones Inmobiliarias</p>
          <p className="text-gray-500 text-xs mt-1">{a.agent_name} &middot; {a.agent_phone} &middot; {a.agent_email}</p>
          <p className="text-gray-600 text-[10px] mt-3">
            Todas las operaciones inmobiliarias son objeto de intermediaci&oacute;n por parte de Marcela Genta, CUCICBA Mat. N&deg;3906
          </p>
        </div>
      </footer>
    </div>
  )
}
