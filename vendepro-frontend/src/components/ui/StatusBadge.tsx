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
interface StatusBadgeProps {
  label: string
  /** Clases de color del mapa de dominio (ej. 'bg-blue-100 text-blue-700'). */
  color?: string
  className?: string
}

const FALLBACK = 'bg-gray-100 text-gray-600'

export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full',
        color ?? FALLBACK,
        className,
      )}
    >
      {label}
    </span>
  )
}
