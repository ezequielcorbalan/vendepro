'use client'
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

type Photo = { id: string; photo_url: string; caption?: string | null; [key: string]: any }

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  function prev() {
    if (lightboxIdx === null) return
    setLightboxIdx(lightboxIdx > 0 ? lightboxIdx - 1 : photos.length - 1)
  }
  function next() {
    if (lightboxIdx === null) return
    setLightboxIdx(lightboxIdx < photos.length - 1 ? lightboxIdx + 1 : 0)
  }

  return (
    <>
      <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-1 h-6 bg-purple-500 rounded-full" />
          Fichas de visita
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all"
              onClick={() => setLightboxIdx(idx)}
            >
              <img
                src={photo.photo_url}
                alt={photo.caption || `Foto ${idx + 1}`}
                className="w-full h-36 sm:h-48 object-cover"
                loading="lazy"
              />
              {photo.caption && (
                <p className="text-xs text-gray-500 p-2">{photo.caption}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {lightboxIdx + 1} / {photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              className="absolute left-2 sm:left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); prev() }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={photos[lightboxIdx].photo_url}
            alt={photos[lightboxIdx].caption || ''}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {photos.length > 1 && (
            <button
              className="absolute right-2 sm:right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); next() }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Caption */}
          {photos[lightboxIdx].caption && (
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white/80 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
                {photos[lightboxIdx].caption}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
