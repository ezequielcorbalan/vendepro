import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MapPin, Ruler, DollarSign } from 'lucide-react'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/prefact/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Prefactibilidad', robots: { index: false } }
    const data = (await res.json()) as any
    const p = data?.prefact
    return {
      title: p?.address ? `Prefactibilidad — ${p.address}` : 'Prefactibilidad',
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Prefactibilidad', robots: { index: false } }
  }
}

export default async function PrefactPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const res = await fetch(`${API_PUBLIC}/public/prefact/${slug}`, { cache: 'no-store' })

  if (!res.ok) notFound()

  const data = (await res.json()) as any

  if (!data || !data.prefact) notFound()

  const p = data.prefact
  const branding = data.branding || { name: 'Inmobiliaria', logo_url: '/logo.png', primary: '#ff007c' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <img src={branding.logo_url} alt={branding.name} className="h-10 object-contain" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl border p-6">
          <h1 className="text-2xl font-bold text-gray-900">Prefactibilidad</h1>
          <p className="text-gray-500 mt-1">{p.address}</p>
          {p.neighborhood && (
            <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />{p.neighborhood}
            </p>
          )}
        </div>

        {(p.land_area || p.buildable_area || p.buildable_m2) && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Ruler className="w-4 h-4" style={{ color: branding.primary }} /> Datos técnicos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {p.land_area && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">{p.land_area}</p>
                  <p className="text-xs text-gray-500 mt-1">m² lote</p>
                </div>
              )}
              {p.buildable_m2 && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">{p.buildable_m2}</p>
                  <p className="text-xs text-gray-500 mt-1">m² construibles</p>
                </div>
              )}
              {p.floors && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xl font-bold text-gray-800">{p.floors}</p>
                  <p className="text-xs text-gray-500 mt-1">pisos</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(p.estimated_value || p.cost_per_m2) && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" style={{ color: branding.primary }} /> Análisis económico
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {p.estimated_value && (
                <div className="text-center p-4 rounded-xl" style={{ background: `${branding.primary}15` }}>
                  <p className="text-2xl font-bold" style={{ color: branding.primary }}>USD {Number(p.estimated_value).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500 mt-1">Valor estimado</p>
                </div>
              )}
              {p.cost_per_m2 && (
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <p className="text-2xl font-bold text-gray-800">USD {Number(p.cost_per_m2).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500 mt-1">por m²</p>
                </div>
              )}
            </div>
          </div>
        )}

        {p.notes && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-3">Observaciones</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{p.notes}</p>
          </div>
        )}

        <div className="text-center py-4">
          <img src={branding.logo_url} alt={branding.name} className="h-10 mx-auto mb-2 object-contain" />
          <p className="text-sm text-gray-400">{branding.name}</p>
        </div>
      </div>
    </div>
  )
}
