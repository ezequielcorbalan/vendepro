import { cn } from '@/lib/utils'

/**
 * Badge de estado GENÉRICO. Unifica la forma del pill (misma anatomía que
 * StageBadge/PropertyStageBadge) para estados que viven en mapas de dominio
 * propios: tasación (draft/generated/sent), campaña, automatización, reporte,
 * rol, etc.
 *
 * El color sigue viniendo del mapa (fuente de verdad del dominio):
 *   const st = AUTOMATION_STATUS[item.status]
 *   <StatusBadge label={st.label} color={st.cls} />
 *
 * Si el estado no existe en el mapa, pasá sólo label y cae al gris.
 */
export type StatusBadgeSize = 'sm' | 'md'

interface StatusBadgeProps {
  label: string
  /** Clases de color del mapa de dominio (ej. 'bg-blue-100 text-blue-700'). */
  color?: string
  /** 'sm' para contextos densos (kanban, tablas). Default 'md'. */
  size?: StatusBadgeSize
  className?: string
}

const FALLBACK = 'bg-gray-100 text-gray-600'

const SIZE: Record<StatusBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2.5 py-1',
}

export function StatusBadge({ label, color, size = 'md', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        SIZE[size],
        color ?? FALLBACK,
        className,
      )}
    >
      {label}
    </span>
  )
}
