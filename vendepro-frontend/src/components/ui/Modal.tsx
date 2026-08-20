'use client'

import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'
import { Portal } from './Portal'
import { useOverlay } from './useOverlay'

/**
 * Modal / dialog del design system. Renderiza en un Portal (no lo atrapan
 * ancestros con overflow/transform), bloquea el scroll del body, atrapa el foco
 * y lo devuelve al cerrar. Cierra con Esc o click en el fondo (por mousedown+
 * mouseup, para no cerrar si soltás afuera tras seleccionar texto adentro).
 */
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Ícono en caja a la izquierda del título. */
  icon?: ReactNode
  /** Caja del ícono en tono destructivo (rojo) en vez del gradiente de marca. */
  danger?: boolean
  children: ReactNode
  footer?: ReactNode
  /**
   * Padding del cuerpo. Desactivalo para contenido a sangre (un header propio,
   * una tabla, un flujo de pasos) y manejá el espaciado adentro.
   */
  padded?: boolean
  className?: string
}

export function Modal({ open, onClose, title, icon, danger = false, children, footer, padded = true, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const downOnScrim = useRef(false)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-overlay-in"
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
          className={cn('bg-white rounded-card w-full max-w-md shadow-pop overflow-hidden outline-none animate-panel-in', className)}
        >
          {title && (
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {icon && (
                  <div
                    className={cn(
                      'w-9 h-9 rounded-card flex items-center justify-center shrink-0 text-white',
                      danger ? 'bg-danger/10 !text-danger' : 'bg-gradient-to-br from-brand-pink to-brand-orange',
                    )}
                  >
                    {icon}
                  </div>
                )}
                <h2 className="text-lg font-semibold text-ink leading-tight">{title}</h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1.5 hover:bg-gray-100 rounded-control shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          )}
          <div className={cn('text-sm text-gray-600', padded && 'px-6 py-4')}>{children}</div>
          {footer && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
