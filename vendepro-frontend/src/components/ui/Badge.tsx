import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Badge / pill de estado del design system.
 *
 * Para estados de dominio (etapas del lead, tipos de evento) usá los componentes
 * específicos StageBadge / EventChip, que leen los colores desde crm-config.
 * Este Badge es para tonos semánticos genéricos.
 */
export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

// Mismo patrón que StageBadge/EventChip (crm-config): fondo -100 + texto -800.
// Los tokens (verde/amarillo/rojo/azul 500) se reservan para sólidos, dots e íconos.
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

interface BadgeProps {
  tone?: BadgeTone
  /** Muestra un punto de color a la izquierda. */
  dot?: boolean
  className?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', DOT_TONES[tone])} aria-hidden />}
      {children}
    </span>
  )
}
