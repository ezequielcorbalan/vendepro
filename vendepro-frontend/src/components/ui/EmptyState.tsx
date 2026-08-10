import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Empty state operativo del design system: ícono en caja primaria translúcida,
 * título, descripción corta y un CTA opcional. Nunca dejar una lista vacía sin guía.
 */
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-9 px-5', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-card bg-primary/10 text-primary grid place-items-center mx-auto mb-3.5">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
