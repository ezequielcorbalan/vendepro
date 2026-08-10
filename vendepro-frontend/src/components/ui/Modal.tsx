'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Modal / dialog genérico del design system. Overlay oscuro + card rounded-card.
 * Cierra con Esc o click en el fondo. Componé el contenido con ModalFooter.
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
  className?: string
}

export function Modal({ open, onClose, title, icon, danger = false, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn('bg-white rounded-card w-full max-w-md shadow-pop overflow-hidden', className)}
        onClick={e => e.stopPropagation()}
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
            <button onClick={onClose} aria-label="Cerrar" className="p-1.5 hover:bg-gray-100 rounded-control shrink-0">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 text-sm text-gray-600">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
