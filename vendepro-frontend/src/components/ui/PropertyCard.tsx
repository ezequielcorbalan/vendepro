import { Bed, Maximize, Bath } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card de propiedad del design system: foto (object-cover) con overlay + precio,
 * badge de estado, y fila de atributos. Hover eleva la sombra.
 */
interface PropertyCardProps {
  title: string
  location: string
  price: string
  /** URL de la foto; si no hay, queda un placeholder gris. */
  image?: string | null
  /** Badge de estado (ej. <Badge tone="success">Publicada</Badge>). */
  status?: ReactNode
  beds?: number
  area?: number
  baths?: number
  className?: string
}

export function PropertyCard({
  title, location, price, image, status, beds, area, baths, className,
}: PropertyCardProps) {
  return (
    <div
      className={cn(
        'w-[270px] bg-white border border-gray-200 rounded-card overflow-hidden shadow-card transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div
        className="relative h-[150px] bg-gray-200 bg-cover bg-center"
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/45" />
        {status && <div className="absolute top-2.5 left-2.5">{status}</div>}
        <div className="absolute bottom-2.5 left-3 text-white font-bold text-[17px] drop-shadow">{price}</div>
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-ink truncate">{title}</div>
        <div className="text-[12.5px] text-gray-500 mt-0.5 truncate">{location}</div>
        {(beds != null || area != null || baths != null) && (
          <div className="flex gap-3.5 mt-2.5 pt-2.5 border-t border-gray-100 text-xs text-gray-500">
            {beds != null && <span className="inline-flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{beds} amb</span>}
            {area != null && <span className="inline-flex items-center gap-1"><Maximize className="w-3.5 h-3.5" />{area} m²</span>}
            {baths != null && <span className="inline-flex items-center gap-1"><Bath className="w-3.5 h-3.5" />{baths} baño{baths === 1 ? '' : 's'}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
