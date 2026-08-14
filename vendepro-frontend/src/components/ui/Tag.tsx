import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tag / chip del design system.
 * - variant "solid" (default): pill blanco con borde, para selección/atributos.
 * - variant "soft": fondo primario translúcido, para etiquetas.
 * Pasá `onRemove` para mostrar la "x" de quitar.
 */
interface TagProps {
  children: ReactNode
  variant?: 'solid' | 'soft'
  icon?: ReactNode
  onRemove?: () => void
  className?: string
}

export function Tag({ children, variant = 'solid', icon, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variant === 'solid'
          ? 'bg-white border border-gray-200 text-ink shadow-card px-4 py-2 text-sm'
          : 'bg-primary/10 text-primary px-3 py-1 text-xs',
        className,
      )}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar"
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </span>
  )
}
