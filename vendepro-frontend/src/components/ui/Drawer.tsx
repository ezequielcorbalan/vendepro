'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Drawer / panel lateral del design system. Entra desde la derecha sobre un
 * scrim. Header + cuerpo scrolleable + footer opcional. Cierra con Esc o click
 * en el fondo.
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
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/35 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div className={cn('relative h-full bg-white shadow-pop flex flex-col max-w-full', width)}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          <button onClick={onClose} aria-label="Cerrar" className="ml-auto p-1.5 hover:bg-gray-100 rounded-control">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  )
}
