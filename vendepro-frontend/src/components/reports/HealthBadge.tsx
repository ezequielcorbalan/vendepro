import { HEALTH_COLORS, type HealthStatus } from '@/lib/semaforo'

interface HealthBadgeProps {
  status: HealthStatus | null
  size?: 'sm' | 'md' | 'lg'
  withLabel?: boolean
  title?: string
}

const SIZE_MAP: Record<NonNullable<HealthBadgeProps['size']>, { dot: string; text: string }> = {
  sm: { dot: 'w-2.5 h-2.5', text: 'text-[10px]' },
  md: { dot: 'w-3 h-3',     text: 'text-xs' },
  lg: { dot: 'w-4 h-4',     text: 'text-sm' },
}

/**
 * Badge circular de color + etiqueta opcional, que representa el estado del
 * semáforo de un reporte/barrio/KPI. Muestra gris/— cuando status es null.
 */
export default function HealthBadge({
  status,
  size = 'md',
  withLabel = false,
  title,
}: HealthBadgeProps) {
  const sz = SIZE_MAP[size]

  if (!status) {
    return (
      <span
        className="inline-flex items-center gap-1 text-gray-400"
        title={title ?? 'Sin datos'}
      >
        <span className={`${sz.dot} rounded-full bg-gray-200`} aria-hidden="true" />
        {withLabel && <span className={sz.text}>—</span>}
      </span>
    )
  }

  const cfg = HEALTH_COLORS[status]
  return (
    <span
      className={`inline-flex items-center gap-1 ${cfg.text}`}
      title={title ?? cfg.label}
    >
      <span className={`${sz.dot} rounded-full ${cfg.dot}`} aria-hidden="true" />
      {withLabel && <span className={`${sz.text} font-medium`}>{cfg.label}</span>}
    </span>
  )
}
