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
 *
 * `padded` es el mismo prop que `Card` y `Drawer`: apagalo cuando el contenido
 * tiene secciones a sangre — una banda de filtros con su propio borde, una lista
 * que scrollea sola.
 *
 * `sheet` lo vuelve un bottom sheet en móvil (pegado abajo, esquinas redondeadas
 * sólo arriba) que en desktop sigue siendo el diálogo centrado de siempre. No es
 * una variante inventada: había SEIS overlays idénticos armados a mano con este
 * mismo layout (leads ×2, calendario, contactos/[id], admin/objetivos), y son
 * pantallas de trabajo de campo, donde `rules/responsive.md` pide sheet — en un
 * teléfono se alcanza con el pulgar y no tapa todo. Migrarlos a un modal centrado
 * habría cambiado UX de campo por consistencia de código.
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
  /** Padding estándar del cuerpo (px-6 py-4). Apagalo para contenido a sangre. */
  padded?: boolean
  /** Bottom sheet en móvil, diálogo centrado en desktop. Para pantallas de campo. */
  sheet?: boolean
  className?: string
}

export function Modal({ open, onClose, title, icon, danger = false, children, footer, padded = true, sheet = false, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const downOnScrim = useRef(false)
  useOverlay(open, onClose, panelRef)

  if (!open) return null

  return (
    <Portal>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 flex justify-center',
          sheet ? 'items-end p-0 sm:items-center sm:p-4' : 'items-center p-4',
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
          className={cn(
            // El panel nunca pasa del 90% del alto de la pantalla y es una
            // columna: encabezado y footer quedan fijos y el cuerpo scrollea.
            // Sin esto un formulario largo se CORTA (el panel tiene
            // `overflow-hidden`) y en un teléfono el final del form queda
            // inalcanzable. No cambia nada para los modales cortos: sin alto
            // fijo, la altura la sigue dando el contenido.
            'bg-white w-full max-w-md shadow-pop overflow-hidden outline-none',
            'max-h-[90vh] flex flex-col',
            sheet ? 'rounded-t-2xl sm:rounded-card' : 'rounded-card',
            className,
          )}
        >
          {title && (
            <div className="shrink-0 flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {icon && (
                  <div
                    className={cn(
                      'w-9 h-9 rounded-card flex items-center justify-center shrink-0 text-white',
                      danger ? 'bg-danger/10 !text-danger' : 'bg-primary/10 !text-primary',
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
          <div className={cn('text-sm text-gray-600 min-h-0 overflow-y-auto', padded && 'px-6 py-4')}>{children}</div>
          {footer && (
            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  )
}
