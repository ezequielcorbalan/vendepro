'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PropertyLite {
  id: string
  address: string
  neighborhood?: string | null
}

interface Photo {
  url: string
}

export default function PropertyPhotoPicker({
  onPick,
  onClose,
}: {
  onPick: (url: string, propertyId: string) => void
  onClose: () => void
}) {
  const [properties, setProperties] = useState<PropertyLite[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingProps, setLoadingProps] = useState(true)
  const [loadingPhotos, setLoadingPhotos] = useState(false)

  useEffect(() => {
    apiFetch('properties', '/properties')
      .then(r => r.json())
      .then((data: any) => {
        // El endpoint devuelve un array directamente; aceptamos también
        // { properties: [...] } por compatibilidad defensiva.
        const list = Array.isArray(data) ? data : Array.isArray(data?.properties) ? data.properties : []
        setProperties(list)
      })
      .catch(() => setProperties([]))
      .finally(() => setLoadingProps(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setPhotos([])
      return
    }
    setLoadingPhotos(true)
    // Las fotos vienen embebidas en el detalle de la propiedad
    apiFetch('properties', `/properties/${selectedId}`)
      .then(r => r.json())
      .then((data: any) => {
        const list = Array.isArray(data?.photos) ? data.photos : []
        setPhotos(list.filter((p: any) => p && p.url).map((p: any) => ({ url: p.url })))
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false))
  }, [selectedId])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        <aside className="w-60 border-r border-gray-200 overflow-auto flex-shrink-0">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold">Propiedades</h3>
          </div>
          {loadingProps && (
            <p className="text-xs text-gray-500 text-center mt-6 px-3">Cargando…</p>
          )}
          {!loadingProps && properties.length === 0 && (
            <p className="text-xs text-gray-500 text-center mt-6 px-3">Sin propiedades</p>
          )}
          {properties.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-3 py-2 text-sm ${
                selectedId === p.id
                  ? 'bg-brand-pink/10 text-brand-pink'
                  : 'hover:bg-gray-50 text-ink'
              }`}
            >
              <p className="font-medium truncate">{p.address || 'Sin dirección'}</p>
              {p.neighborhood && (
                <p className="text-xs text-gray-500 truncate">{p.neighborhood}</p>
              )}
            </button>
          ))}
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold">Fotos</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 grid grid-cols-3 gap-2 content-start">
            {photos.map((ph, i) => (
              <button
                key={i}
                onClick={() => onPick(ph.url, selectedId!)}
                className="aspect-square bg-cover bg-center rounded-lg ring-1 ring-gray-200 hover:ring-brand-pink transition-shadow"
                style={{ backgroundImage: `url(${ph.url})` }}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
            {selectedId && loadingPhotos && (
              <p className="col-span-3 text-sm text-gray-500 text-center mt-8">
                Cargando fotos…
              </p>
            )}
            {selectedId && !loadingPhotos && photos.length === 0 && (
              <p className="col-span-3 text-sm text-gray-500 text-center mt-8">
                Esta propiedad no tiene fotos.
              </p>
            )}
            {!selectedId && (
              <p className="col-span-3 text-sm text-gray-500 text-center mt-8">
                Elegí una propiedad a la izquierda.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
