'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export interface ReportPhoto {
  id: string
  photo_url: string
  caption?: string | null
}

/**
 * Grilla de fotos del reporte público con lightbox: click en una foto la abre
 * ampliada sobre el Modal del DS (Esc, scroll-lock y manejo de foco vienen de
 * ahí), con navegación anterior/siguiente en pantalla y por teclado.
 */
export function ReportPhotoGallery({ photos }: { photos: ReportPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null)
  const open = index !== null
  const photo = open ? photos[index] : null

  const prev = () => setIndex(i => (i === null ? i : (i + photos.length - 1) % photos.length))
  const next = () => setIndex(i => (i === null ? i : (i + 1) % photos.length))

  useEffect(() => {
    if (!open || photos.length < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex(i => (i === null ? i : (i + photos.length - 1) % photos.length))
      if (e.key === 'ArrowRight') setIndex(i => (i === null ? i : (i + 1) % photos.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos.length])

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          /* ds-todo: botón-imagen (tile de galería), no encaja en <Button> del DS */
          <button
            key={p.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Ampliar ${p.caption || 'foto'}`}
            className="cursor-zoom-in rounded-card overflow-hidden focus-visible:outline-2 focus-visible:outline-primary"
          >
            <img
              src={p.photo_url}
              alt={p.caption || 'Foto'}
              className="w-full aspect-square object-cover transition-transform hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {/* ds-todo: candidato a componente "Lightbox" — es el Modal del DS con el panel transparente y controles sobre la imagen */}
      <Modal
        open={open}
        onClose={() => setIndex(null)}
        padded={false}
        className="max-w-4xl bg-transparent shadow-none"
      >
        {photo && (
          <div className="relative">
            <img
              src={photo.photo_url}
              alt={photo.caption || 'Foto'}
              className="w-full max-h-[80vh] object-contain rounded-card"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              onClick={() => setIndex(null)}
              className="absolute top-2 right-2 rounded-full text-white bg-black/40 hover:bg-black/60"
            >
              <X className="w-5 h-5" />
            </Button>
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Foto anterior"
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full text-white bg-black/40 hover:bg-black/60"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Foto siguiente"
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full text-white bg-black/40 hover:bg-black/60"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </>
            )}
            {(photo.caption || photos.length > 1) && (
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-sm text-white/90">
                <span className="truncate">{photo.caption}</span>
                {photos.length > 1 && (
                  <span className="shrink-0">
                    {(index ?? 0) + 1} / {photos.length}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
