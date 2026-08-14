import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card del design system: superficie blanca, borde gris y sombra suave.
 * Radio unificado en `rounded-card`. Editá acá el estilo base de todas las cards.
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Aplica el padding interno estándar (p-5). Desactivalo para media/tablas a
   *  sangre. Para otro padding, pasá className="p-6" (tailwind-merge lo pisa). */
  padded?: boolean
  /** Eleva la sombra en hover (para cards clickeables). */
  interactive?: boolean
}

export function Card({ padded = true, interactive = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-card shadow-card',
        padded && 'p-5',
        interactive && 'transition-shadow hover:shadow-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>{children}</div>
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-sm font-semibold text-ink', className)}>{children}</h3>
}
