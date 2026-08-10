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

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral/10 text-neutral',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
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
