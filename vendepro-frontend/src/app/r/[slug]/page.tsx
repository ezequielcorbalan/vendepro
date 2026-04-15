import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/report/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Reporte de propiedad', robots: { index: false } }
    const data = (await res.json()) as any
    const property = data?.property
    if (!property) return { title: 'Reporte de propiedad', robots: { index: false } }
    return {
      title: `Reporte de gestión — ${property.address}`,
      description: `Métricas de comercialización de ${property.address}. Impresiones, consultas y visitas del período.`,
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Reporte de propiedad', robots: { index: false } }
  }
}

export default async function PublicReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ reporte?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const reportParam = sp.reporte ? `?reporte=${sp.reporte}` : ''

  const res = await fetch(`${API_PUBLIC}/public/report/${slug}${reportParam}`, { cache: 'no-store' })

  if (!res.ok) notFound()

  const data = (await res.json()) as any

  if (!data || !data.property) notFound()

  const property = data.property
  const report = data.report || data.reports?.[0]
  const metrics = data.metrics || {}
  const content = data.content || []
  const photos = data.photos || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <img src="/logo.png" alt="Logo" className="h-10" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
          <p className="text-gray-500 mt-1">{property.neighborhood} · {property.city}</p>
          {report && (
            <p className="text-sm text-gray-400 mt-2">
              Reporte: {report.period_label} · {report.status === 'published' ? 'Publicado' : 'Borrador'}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Property info */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Información de la propiedad</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {property.property_type && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Tipo</p>
                <p className="font-medium text-gray-700 capitalize">{property.property_type}</p>
              </div>
            )}
            {property.rooms && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Ambientes</p>
                <p className="font-medium text-gray-700">{property.rooms}</p>
              </div>
            )}
            {property.size_m2 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Superficie</p>
                <p className="font-medium text-gray-700">{property.size_m2} m²</p>
              </div>
            )}
            {property.asking_price && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Precio</p>
                <p className="font-medium text-[#ff007c]">{property.currency} {Number(property.asking_price).toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        {(metrics.impressions || metrics.portal_visits || metrics.inquiries) && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Métricas del período</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Impresiones', value: metrics.impressions, color: 'blue' },
                { label: 'Visitas al portal', value: metrics.portal_visits, color: 'cyan' },
                { label: 'Consultas', value: metrics.inquiries, color: 'purple' },
                { label: 'Visitas presenciales', value: metrics.in_person_visits, color: 'green' },
              ].filter(m => m.value).map(m => (
                <div key={m.label} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-800">{m.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content sections */}
        {content.map((section: any) => (
          <div key={section.id} className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3">{section.title}</h2>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{section.body}</div>
          </div>
        ))}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Fotos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo: any) => (
                <img key={photo.id} src={photo.photo_url} alt={photo.caption || 'Foto'} className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
