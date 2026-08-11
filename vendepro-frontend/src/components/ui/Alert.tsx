import type { ReactNode } from 'react'
import { Info, CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Alert / callout del design system. Reemplaza los recuadros de estado sueltos
 * (bg-red-50 text-red-600, etc.). Usa los tokens semánticos.
 */
export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<AlertTone, string> = {
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  /** Ocultar el ícono. */
  hideIcon?: boolean
  className?: string
}

export function Alert({ tone = 'info', title, children, hideIcon = false, className }: AlertProps) {
  const Icon = ICONS[tone]
  return (
    <div className={cn('flex gap-3 rounded-card p-4 text-sm', TONES[tone], className)} role="status">
      {!hideIcon && <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}
