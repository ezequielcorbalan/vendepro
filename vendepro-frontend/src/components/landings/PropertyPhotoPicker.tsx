'use client'
import { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { CardTitle } from '@/components/ui/Card'
import { Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'

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
    <Modal
      open
      onClose={onClose}
      title="Elegir una foto"
      icon={<ImageIcon className="w-5 h-5" />}
      padded={false}
      className="max-w-3xl"
    >
      {/* Dos paneles a sangre: el alto lo pone acá y cada panel scrollea solo. */}
      <div className="flex h-[70vh]">
        <aside className="w-60 border-r border-gray-200 overflow-auto flex-shrink-0">
          <div className="p-3 border-b border-gray-200">
            <CardTitle>Propiedades</CardTitle>
          </div>
          {loadingProps && (
            <Text size="xs" tone="muted" className="text-center mt-6 px-3">Cargando…</Text>
          )}
          {!loadingProps && properties.length === 0 && (
            <Text size="xs" tone="muted" className="text-center mt-6 px-3">Sin propiedades</Text>
          )}
          {properties.map(p => (
            <Button variant="ghost" size="sm"
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-3 py-2 text-sm ${
                selectedId === p.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-gray-50 text-ink'
              }`}
            >
              <span className="block font-medium truncate">{p.address || 'Sin dirección'}</span>
              {p.neighborhood && (
                <span className="block text-xs text-gray-500 truncate">{p.neighborhood}</span>
              )}
            </Button>
          ))}
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 border-b border-gray-200">
            <CardTitle>Fotos</CardTitle>
          </div>
          <div className="flex-1 overflow-auto p-3 grid grid-cols-3 gap-2 content-start">
            {photos.map((ph, i) => (
              <Button variant="ghost" size="icon"
                key={i}
                onClick={() => onPick(ph.url, selectedId!)}
                className="p-0 aspect-square bg-cover bg-center rounded-control ring-1 ring-gray-200 hover:ring-primary transition-shadow"
                style={{ backgroundImage: `url(${ph.url})` }}
                aria-label={`Foto ${i + 1}`}
              />
            ))}
            {selectedId && loadingPhotos && (
              <Text size="sm" tone="muted" className="col-span-3 text-center mt-8">Cargando fotos…</Text>
            )}
            {selectedId && !loadingPhotos && photos.length === 0 && (
              <Text size="sm" tone="muted" className="col-span-3 text-center mt-8">Esta propiedad no tiene fotos.</Text>
            )}
            {!selectedId && (
              <Text size="sm" tone="muted" className="col-span-3 text-center mt-8">Elegí una propiedad a la izquierda.</Text>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
