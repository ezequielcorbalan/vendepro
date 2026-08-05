'use client'

import {
  Ruler, TrendingUp, Phone, MessageCircle, FileText, MapPin,
  LineChart, Handshake, Film, CheckCircle2,
} from 'lucide-react'

/**
 * Shared renderer for the public tasación landing (/t/[slug]) and for the
 * in-wizard live preview. Handles missing/empty data gracefully so it can be
 * used while the user is still filling the wizard form.
 */

export interface PublicAppraisalData {
  appraisal: {
    property_address?: string | null
    neighborhood?: string | null
    city?: string | null
    property_type?: string | null
    covered_area?: number | string | null
    total_area?: number | string | null
    semi_area?: number | string | null
    weighted_area?: number | string | null
    usd_per_m2?: number | string | null
    suggested_price?: number | string | null
    test_price?: number | string | null
    expected_close_price?: number | string | null
    strengths?: string | null
    weaknesses?: string | null
    opportunities?: string | null
    threats?: string | null
    publication_analysis?: string | null
    agent_notes?: string | null
    video_tasacion_url?: string | null
    zone_avg_price?: number | string | null
    zone_avg_m2?: number | string | null
    zone_avg_usd_m2?: number | string | null
    contact_phone?: string | null
    contact_name?: string | null
    agent_name?: string | null
    // Block fields
    proposal?: {
      title?: string
      subtitle?: string | null
      body?: string | null
      show_agent_signature?: boolean
    } | null
    market_situation?: {
      title?: string
      body?: string | null
      media_urls?: string[]
    } | null
    work_conditions?: {
      honorarios_pct?: number | null
      honorarios_usd?: number | null
      exclusividad?: boolean
      exclusividad_meses?: number | null
      extras?: string[]
      legal_text?: string | null
    } | null
    video_links?: string[] | null
  }
  comparables?: any[]
  branding?: {
    name?: string
    logo_url?: string | null
    primary?: string
    accent?: string
  }
}

function youtubeEmbed(url: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  return url
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-gray-300 italic">{children}</span>
  )
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export default function PublicAppraisalShell({ data }: { data: PublicAppraisalData }) {
  const appraisal = data.appraisal || ({} as any)
  const comparables = data.comparables || []
  const branding = {
    name: data.branding?.name ?? 'Inmobiliaria',
    logo_url: data.branding?.logo_url ?? null,
    primary: data.branding?.primary ?? '#ff007c',
    accent: data.branding?.accent ?? '#ff8017',
  }

  const suggested = num(appraisal.suggested_price)
  const testP = num(appraisal.test_price)
  const closeP = num(appraisal.expected_close_price)
  const covered = num(appraisal.covered_area)
  const total = num(appraisal.total_area)
  const weighted = num(appraisal.weighted_area)
  const usdM2 = num(appraisal.usd_per_m2)

  const proposal = appraisal.proposal
  const market = appraisal.market_situation
  const work = appraisal.work_conditions
  const videoLinks = (appraisal.video_links || []).filter(Boolean)

  return (
    <div className="min-h-full" style={{ fontFamily: 'Poppins, sans-serif', background: '#f9fafb' }}>
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-10 object-contain" />
          ) : (
            <div className="h-10 flex items-center text-sm font-semibold text-gray-700">{branding.name}</div>
          )}
          <div className="flex items-center gap-2">
            {appraisal.contact_phone && (
              <>
                <a href={`tel:${appraisal.contact_phone}`} className="p-2 rounded-lg border hover:bg-gray-50 text-gray-600">
                  <Phone className="w-4 h-4" />
                </a>
                <a href={`https://wa.me/${String(appraisal.contact_phone).replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  className="p-2 rounded-lg border hover:bg-green-50 text-green-600">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* 1. Propuesta comercial */}
        {proposal && (proposal.title || proposal.body) && (
          <section className="bg-white rounded-2xl border p-6">
            <div className="flex items-start gap-3 mb-3">
              <FileText className="w-5 h-5 mt-1" style={{ color: branding.primary }} />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-ink">
                  {proposal.title || 'Propuesta de Comercialización'}
                </h2>
                {proposal.subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{proposal.subtitle}</p>
                )}
              </div>
            </div>
            {proposal.body ? (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {proposal.body}
              </div>
            ) : (
              <Placeholder>Cuerpo de la propuesta…</Placeholder>
            )}
            {proposal.show_agent_signature !== false && appraisal.agent_name && (
              <p className="text-sm text-gray-500 mt-4 italic">— {appraisal.agent_name}</p>
            )}
          </section>
        )}

        {/* 2. Propiedad — Hero + datos */}
        <section className="bg-white rounded-2xl border overflow-hidden">
          <div
            className="p-6"
            style={{ background: `linear-gradient(135deg, ${branding.primary}15, ${branding.accent}15)` }}
          >
            <div className="flex items-start gap-2">
              <MapPin className="w-5 h-5 mt-1" style={{ color: branding.primary }} />
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-ink">
                  {appraisal.property_address || <Placeholder>Dirección…</Placeholder>}
                </h1>
                <p className="text-gray-500 mt-1">
                  {appraisal.neighborhood || <Placeholder>Barrio</Placeholder>}
                  {appraisal.city ? `, ${appraisal.city}` : ''}
                </p>
                {appraisal.contact_name && (
                  <p className="text-sm text-gray-400 mt-2">Propietario: {appraisal.contact_name}</p>
                )}
              </div>
            </div>
          </div>
          {(covered || total || weighted || usdM2) && (
            <div className="px-6 py-4 border-t flex items-center gap-2 text-sm">
              <Ruler className="w-4 h-4" style={{ color: branding.primary }} />
              <span className="text-gray-600">
                {covered != null && <>{covered} m² cub · </>}
                {total != null && <>{total} m² tot · </>}
                {weighted != null && <>{weighted.toFixed(1)} m² pond · </>}
                {usdM2 != null && <>USD {usdM2.toLocaleString('es-AR')}/m²</>}
              </span>
            </div>
          )}
          {suggested != null && (
            <div className="px-6 py-4 border-t">
              <p className="text-xs text-gray-400 mb-1">Precio sugerido de publicación</p>
              <p className="text-3xl font-bold" style={{ color: branding.primary }}>
                USD {suggested.toLocaleString('es-AR')}
              </p>
            </div>
          )}
        </section>

        {/* 3. FODA */}
        {(appraisal.strengths || appraisal.weaknesses || appraisal.opportunities || appraisal.threats) && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-4">Análisis FODA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {appraisal.strengths && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="font-medium text-green-800 mb-1 text-sm">Fortalezas</p>
                  <p className="text-sm text-green-700 whitespace-pre-wrap">{appraisal.strengths}</p>
                </div>
              )}
              {appraisal.weaknesses && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="font-medium text-amber-800 mb-1 text-sm">Debilidades</p>
                  <p className="text-sm text-amber-700 whitespace-pre-wrap">{appraisal.weaknesses}</p>
                </div>
              )}
              {appraisal.opportunities && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="font-medium text-blue-800 mb-1 text-sm">Oportunidades</p>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap">{appraisal.opportunities}</p>
                </div>
              )}
              {appraisal.threats && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="font-medium text-red-800 mb-1 text-sm">Amenazas</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{appraisal.threats}</p>
                </div>
              )}
            </div>
            {appraisal.publication_analysis && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <p className="font-medium text-ink mb-1 text-sm">Análisis de publicación</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{appraisal.publication_analysis}</p>
              </div>
            )}
          </section>
        )}

        {/* 4. Competencia */}
        {comparables.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: branding.primary }} /> Competencia de mercado
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Dirección</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">m²</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Precio</th>
                    <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">USD/m²</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c: any, i: number) => (
                    <tr key={c.id || i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-700 truncate max-w-[200px]">
                        {c.zonaprop_url ? (
                          <a href={c.zonaprop_url} target="_blank" rel="noreferrer" className="hover:underline text-blue-600">
                            {c.address || 'Ver publicación'}
                          </a>
                        ) : (c.address || '-')}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">{c.total_area || c.covered_area || '-'}</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: branding.primary }}>
                        {c.price ? `USD ${Number(c.price).toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">
                        {c.usd_per_m2 ? `${Number(c.usd_per_m2).toFixed(0)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 5. Situación de mercado */}
        {market && (market.title || market.body || (market.media_urls && market.media_urls.length > 0)) && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
              <LineChart className="w-4 h-4" style={{ color: branding.primary }} />
              {market.title || 'Situación del mercado'}
            </h2>
            {market.body ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap mb-4">{market.body}</p>
            ) : (
              <p className="text-sm"><Placeholder>Texto del bloque de situación de mercado…</Placeholder></p>
            )}
            {market.media_urls && market.media_urls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {market.media_urls.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full h-32 object-cover rounded-lg border" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6. Tasación (valores sugeridos) */}
        {(suggested != null || testP != null || closeP != null) && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-4">Valores sugeridos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggested != null && (
                <div className="p-4 rounded-lg" style={{ background: `${branding.primary}10` }}>
                  <p className="text-xs text-gray-500">Precio sugerido</p>
                  <p className="text-xl font-bold" style={{ color: branding.primary }}>
                    USD {suggested.toLocaleString('es-AR')}
                  </p>
                </div>
              )}
              {testP != null && (
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Prueba 30 días</p>
                  <p className="text-xl font-bold text-ink">USD {testP.toLocaleString('es-AR')}</p>
                </div>
              )}
              {closeP != null && (
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500">Cierre 120 días</p>
                  <p className="text-xl font-bold text-ink">USD {closeP.toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
            {appraisal.agent_notes && (
              <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{appraisal.agent_notes}</p>
            )}
          </section>
        )}

        {/* 7. Videos de la propiedad */}
        {videoLinks.length > 0 && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
              <Film className="w-4 h-4" style={{ color: branding.primary }} /> Videos de la propiedad
            </h2>
            <div className="space-y-4">
              {videoLinks.map((url, i) => {
                const embed = youtubeEmbed(url)
                return embed ? (
                  <div key={i} className="aspect-video rounded-xl overflow-hidden">
                    <iframe
                      src={embed}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    />
                  </div>
                ) : (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                    {url}
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {/* Video explicativo del tasador (campo separado existente) */}
        {appraisal.video_tasacion_url && youtubeEmbed(appraisal.video_tasacion_url) && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-3">Video del tasador</h2>
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                src={youtubeEmbed(appraisal.video_tasacion_url) || ''}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </section>
        )}

        {/* 8. Condiciones de trabajo */}
        {work && (
          work.honorarios_pct != null || work.honorarios_usd != null || work.exclusividad ||
          (work.extras && work.extras.length > 0) || work.legal_text
        ) && (
          <section className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-ink mb-3 flex items-center gap-2">
              <Handshake className="w-4 h-4" style={{ color: branding.primary }} /> Condiciones de trabajo
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {work.honorarios_pct != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <dt className="text-xs text-gray-500">Honorarios</dt>
                  <dd className="font-semibold">{work.honorarios_pct}%</dd>
                </div>
              )}
              {work.honorarios_usd != null && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <dt className="text-xs text-gray-500">Honorarios (USD)</dt>
                  <dd className="font-semibold">USD {Number(work.honorarios_usd).toLocaleString('es-AR')}</dd>
                </div>
              )}
              {work.exclusividad && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <dt className="text-xs text-gray-500">Exclusividad</dt>
                  <dd className="font-semibold">
                    {work.exclusividad_meses ? `${work.exclusividad_meses} meses` : 'Sí'}
                  </dd>
                </div>
              )}
            </dl>
            {work.extras && work.extras.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Servicios incluidos</p>
                <ul className="space-y-1.5">
                  {work.extras.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 mt-0.5" style={{ color: branding.primary }} />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {work.legal_text && (
              <p className="mt-4 text-[11px] text-gray-400 whitespace-pre-wrap">{work.legal_text}</p>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          {branding.logo_url && (
            <img src={branding.logo_url} alt={branding.name} className="h-10 mx-auto mb-3 object-contain" />
          )}
          <p className="text-sm text-gray-400">{branding.name}</p>
          {appraisal.contact_phone && (
            <a href={`tel:${appraisal.contact_phone}`} className="text-sm mt-1 block hover:underline" style={{ color: branding.primary }}>
              {appraisal.contact_phone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
