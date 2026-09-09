'use client'

import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'
import { Portal } from './Portal'
import { useOverlay } from './useOverlay'

/**
 * Drawer / panel lateral del design system. Entra desde la derecha, o desde la
 * izquierda con `side="left"`. Portal +
 * scroll-lock + focus-trap + devolución de foco. Cierra con Esc o click en el
 * fondo (mousedown+mouseup, para no cerrar al soltar afuera tras seleccionar).
 *
 * `header` existe porque no todo panel lateral tiene un título de una línea: el
 * asistente de IA lleva medallón + nombre + modelo, y por armarlo a mano se
 * había quedado sin Esc, sin scroll-lock y sin focus-trap. El slot recibe el
 * contenido; la X y el borde los sigue poniendo el Drawer.
 *
 * `side` salió del nav móvil, que es el único panel que entra por la izquierda
 * (la navegación vive a la izquierda en desktop, así que abrirla desde la
 * derecha se lee como otra cosa). Por eso estaba armado a mano y no cerraba con
 * Esc.
 *
 * `padded` es el mismo prop que `Card`: apagalo cuando el contenido tiene
 * secciones a sangre (una fila de tabs con su propio borde, una lista).
 */
interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Header propio, en vez del `title` de una línea. La X la pone el Drawer. */
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Padding estándar del cuerpo (px-5 py-4). Apagalo para contenido a sangre. */
  padded?: boolean
  /** Ancho del panel. Default w-[380px]. */
  width?: string
  /** Lado por el que entra. Default 'right'. */
  side?: 'left' | 'right'
  /** Clases extra para el scrim — p.ej. `lg:hidden` en el nav móvil. */
  className?: string
}

export function Drawer({ open, onClose, title, header, children, footer, padded = true, width = 'w-[380px]', side = 'right', className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const downOnScrim = useRef(false)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return (
    <Portal>
      <div
        className={cn(
          'fixed inset-0 flex bg-black/35',
          side === 'left' ? 'justify-start' : 'justify-end',
          className,
        )}
        style={{ zIndex: Z.modal }}
        onMouseDown={e => { downOnScrim.current = e.target === e.currentTarget }}
        onMouseUp={e => { if (downOnScrim.current && e.target === e.currentTarget) onClose() }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={cn('relative h-full bg-white shadow-pop flex flex-col max-w-full outline-none', width)}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
            {header ?? (title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>)}
            <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto p-1.5 hover:bg-gray-100 rounded-control">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className={cn('flex-1 overflow-y-auto', padded && 'px-5 py-4')}>{children}</div>
          {footer && <div className="px-5 py-4 border-t border-gray-100">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
