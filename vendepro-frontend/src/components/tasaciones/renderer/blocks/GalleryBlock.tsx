import { X } from 'lucide-react'
import { GalleryEditControls } from './GalleryEditControls'

interface GalleryImage { url: string; caption?: string }
interface Data { images?: GalleryImage[]; columns?: 2 | 3 | 4 }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
}

export function GalleryBlock({ data, edit, ...attrs }: Props) {
  const images = data.images ?? []
  const cols = COLS[data.columns ?? 3]

  if (!edit && images.length === 0) return null

  return (
    <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
      <div className="mx-auto max-w-5xl">
        <div className={`grid gap-2 ${cols}`}>
          {images.map((img, i) => (
            <figure key={`${img.url}-${i}`} className="group/gimg relative">
              <img src={img.url} alt={img.caption ?? ''} className="aspect-square w-full rounded-lg object-cover" />
              {edit && (
                <button
                  type="button"
                  onClick={() => edit.onChange({ images: images.filter((_, j) => j !== i) })}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover/gimg:opacity-100"
                  title="Quitar imagen"
                  aria-label="Quitar imagen de la galería"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {img.caption && !edit && (
                <figcaption className="mt-1 text-center text-xs text-slate-500">{img.caption}</figcaption>
              )}
            </figure>
          ))}
          {edit && (
            <GalleryEditControls onAdd={(added) => edit.onChange({ images: [...images, ...added] })} />
          )}
        </div>
      </div>
    </section>
  )
}
