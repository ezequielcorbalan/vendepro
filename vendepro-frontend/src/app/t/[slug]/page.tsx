import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Ruler, TrendingUp, Calendar, Phone, MessageCircle, Home, Monitor } from 'lucide-react'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Informe de tasación', robots: { index: false } }
    const data = (await res.json()) as any
    const appraisal = data?.appraisal
    if (!appraisal) return { title: 'Informe de tasación', robots: { index: false } }
    const branding = data.branding || { name: 'Inmobiliaria' }
    return {
      title: `Tasación — ${appraisal.property_address}`,
      description: `Informe de tasación profesional para ${appraisal.property_address}. Preparado por ${branding.name}.`,
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Informe de tasación', robots: { index: false } }
  }
}

function youtubeEmbed(url: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  return url
}

export default async function PublicTasacionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const res = await fetch(`${API_PUBLIC}/public/appraisal/${slug}`, { cache: 'no-store' })

  if (!res.ok) notFound()

  const data = (await res.json()) as any

  if (!data || !data.appraisal) notFound()

  const appraisal = data.appraisal
  const blocks = data.blocks || []
  const comparables = data.comparables || []
  const branding = data.branding || { name: 'Inmobiliaria', logo_url: '/logo.png', primary: '#ff007c', accent: '#ff8017' }
  const soldProperties = data.sold_properties || []

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Poppins, sans-serif', background: '#f9fafb' }}>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={branding.logo_url} alt={branding.name} className="h-10 object-contain" />
          <div className="flex items-center gap-2">
            {appraisal.contact_phone && (
              <>
                <a href={`tel:${appraisal.contact_phone}`} className="p-2 rounded-lg border hover:bg-gray-50 text-gray-600">
                  <Phone className="w-4 h-4" />
                </a>
                <a href={`https://wa.me/${appraisal.contact_phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  className="p-2 rounded-lg border hover:bg-green-50 text-green-600">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-6" style={{ background: `linear-gradient(135deg, ${branding.primary}15, ${branding.accent}15)` }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{appraisal.property_address}</h1>
            <p className="text-gray-500 mt-1">{appraisal.neighborhood}{appraisal.city ? `, ${appraisal.city}` : ''}</p>
            {appraisal.contact_name && (
              <p className="text-sm text-gray-400 mt-2">Propietario: {appraisal.contact_name}</p>
            )}
          </div>
          {appraisal.suggested_price && (
            <div className="px-6 py-4 border-t">
              <p className="text-xs text-gray-400 mb-1">Precio sugerido de publicación</p>
              <p className="text-3xl font-bold" style={{ color: branding.primary }}>
                USD {Number(appraisal.suggested_price).toLocaleString('es-AR')}
              </p>
            </div>
          )}
        </div>

        {/* Metrics */}
        {(appraisal.covered_area || appraisal.total_area || appraisal.usd_per_m2) && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Ruler className="w-4 h-4" style={{ color: branding.primary }} /> Datos de la propiedad
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {appraisal.covered_area && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">{appraisal.covered_area}</p>
                  <p className="text-xs text-gray-500 mt-1">m² cubiertos</p>
                </div>
              )}
              {appraisal.total_area && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">{appraisal.total_area}</p>
                  <p className="text-xs text-gray-500 mt-1">m² totales</p>
                </div>
              )}
              {appraisal.usd_per_m2 && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">USD {Number(appraisal.usd_per_m2).toFixed(0)}</p>
                  <p className="text-xs text-gray-500 mt-1">por m²</p>
                </div>
              )}
              {appraisal.property_type && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800 capitalize">{appraisal.property_type}</p>
                  <p className="text-xs text-gray-500 mt-1">tipo</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SWOT */}
        {(appraisal.strengths || appraisal.weaknesses) && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Análisis de la propiedad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {appraisal.strengths && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="font-medium text-green-800 mb-2 text-sm">Fortalezas</p>
                  <p className="text-sm text-green-700 whitespace-pre-wrap">{appraisal.strengths}</p>
                </div>
              )}
              {appraisal.weaknesses && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="font-medium text-amber-800 mb-2 text-sm">Debilidades</p>
                  <p className="text-sm text-amber-700 whitespace-pre-wrap">{appraisal.weaknesses}</p>
                </div>
              )}
              {appraisal.opportunities && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="font-medium text-blue-800 mb-2 text-sm">Oportunidades</p>
                  <p className="text-sm text-blue-700 whitespace-pre-wrap">{appraisal.opportunities}</p>
                </div>
              )}
              {appraisal.threats && (
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="font-medium text-red-800 mb-2 text-sm">Amenazas</p>
                  <p className="text-sm text-red-700 whitespace-pre-wrap">{appraisal.threats}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comparables */}
        {comparables.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: branding.primary }} /> Comparables del mercado
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
                          <a href={c.zonaprop_url} target="_blank" rel="noreferrer" className="hover:underline text-blue-600">{c.address || 'Ver publicación'}</a>
                        ) : (c.address || '-')}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">{c.total_area || c.covered_area || '-'}</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: branding.primary }}>
                        {c.price ? `USD ${Number(c.price).toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600">{c.usd_per_m2 ? `${Number(c.usd_per_m2).toFixed(0)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Template blocks */}
        {blocks.map((block: any) => (
          <div key={block.id} className="bg-white rounded-xl border p-6">
            {block.block_type === 'video' && block.video_url ? (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">{block.title}</h3>
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={youtubeEmbed(block.video_url) || ''}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
                {block.description && <p className="text-sm text-gray-500 mt-3">{block.description}</p>}
              </div>
            ) : block.block_type === 'stats' ? (
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">{block.title}</h3>
                {block.number_label && <p className="text-4xl font-bold mt-2" style={{ color: branding.primary }}>{block.number_label}</p>}
                {block.description && <p className="text-sm text-gray-600 mt-2">{block.description}</p>}
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">{block.title}</h3>
                {block.description && <p className="text-sm text-gray-600">{block.description}</p>}
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div className="text-center py-6">
          <img src={branding.logo_url} alt={branding.name} className="h-10 mx-auto mb-3 object-contain" />
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
