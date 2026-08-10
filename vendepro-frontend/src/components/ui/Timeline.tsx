import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Timeline vertical del design system (historial de etapas / actividad).
 * Cada ítem lleva un punto de color (ej. el color de la etapa desde crm-config).
 */
export interface TimelineItem {
  label: ReactNode
  meta?: ReactNode
  /** Color del punto (hex). Default = primario. */
  color?: string
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <div className={cn('relative pl-6', className)}>
      <span className="absolute left-[5px] top-1 bottom-1 w-0.5 bg-gray-200" aria-hidden />
      <ul className="flex flex-col gap-4">
        {items.map((item, i) => (
          <li key={i} className="relative">
            <span
              className="absolute -left-6 top-0.5 w-3 h-3 rounded-full border-2 border-white ring-1 ring-gray-200"
              style={{ backgroundColor: item.color ?? 'var(--color-primary)' }}
              aria-hidden
            />
            <div className="text-sm font-semibold text-ink">{item.label}</div>
            {item.meta && <div className="text-xs text-gray-400 mt-0.5">{item.meta}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
