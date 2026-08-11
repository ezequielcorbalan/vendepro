import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'

/**
 * Tooltip del design system: etiqueta oscura al hacer hover/focus sobre el
 * contenido. Solo CSS (group-hover), sin estado. Posición: arriba por defecto.
 */
interface TooltipProps {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('relative inline-flex group', className)}>
      {children}
      <span
        role="tooltip"
        style={{ zIndex: Z.tooltip }}
        className={cn(
          'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap',
          'bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-control shadow-pop',
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {label}
      </span>
    </span>
  )
}
