import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const API_PUBLIC = process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? 'http://localhost:8708'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  try {
    const res = await fetch(`${API_PUBLIC}/public/visit-form/${slug}`, { cache: 'no-store' })
    if (!res.ok) return { title: 'Formulario de visita', robots: { index: false } }
    const data = (await res.json()) as any
    return {
      title: data?.address ? `Visita — ${data.address}` : 'Formulario de visita',
      robots: { index: false, follow: false },
    }
  } catch {
    return { title: 'Formulario de visita', robots: { index: false } }
  }
}

export default async function VisitFormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const res = await fetch(`${API_PUBLIC}/public/visit-form/${slug}`, { cache: 'no-store' })

  if (!res.ok) notFound()

  const data = (await res.json()) as any

  if (!data) notFound()

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border overflow-hidden">
          {data.cover_photo && (
            <img src={data.cover_photo} alt={data.address} className="w-full h-48 object-cover" />
          )}
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900">{data.address}</h1>
            {data.neighborhood && <p className="text-gray-500 text-sm mt-1">{data.neighborhood}</p>}

            <div className="mt-6 space-y-4">
              <h2 className="font-semibold text-gray-700">Información de la visita</h2>
              {data.fields?.map((field: any) => (
                <div key={field.id}>
                  <p className="text-xs text-gray-400 mb-1">{field.label}</p>
                  <p className="text-sm text-gray-700">{field.value || '-'}</p>
                </div>
              ))}
            </div>

            {data.photos?.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-700 mb-3">Fotos</h2>
                <div className="grid grid-cols-2 gap-2">
                  {data.photos.map((p: any) => (
                    <img key={p.id} src={p.photo_url} alt={p.caption || 'Foto'} className="w-full aspect-square object-cover rounded-lg" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
