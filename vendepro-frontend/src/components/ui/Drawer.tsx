'use client'

import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'
import { Portal } from './Portal'
import { useOverlay } from './useOverlay'

/**
 * Drawer / panel lateral del design system. Entra desde la derecha. Portal +
 * scroll-lock + focus-trap + devolución de foco. Cierra con Esc o click en el
 * fondo (mousedown+mouseup, para no cerrar al soltar afuera tras seleccionar).
 */
interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Ancho del panel. Default w-[380px]. */
  width?: string
}

export function Drawer({ open, onClose, title, children, footer, width = 'w-[380px]' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const downOnScrim = useRef(false)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return (
    <Portal>
      <div
        className="fixed inset-0 flex justify-end bg-black/35"
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
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto p-1.5 hover:bg-gray-100 rounded-control">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="px-5 py-4 border-t border-gray-100">{footer}</div>}
        </div>
      </div>
    </Portal>
  )
}
