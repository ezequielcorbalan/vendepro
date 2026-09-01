import { cn } from '@/lib/utils'
import {
  PROPERTY_STAGES,
  PROPERTY_ALT_STATUSES,
  resolvePropertyStage,
  type PropertyStage,
} from '@/lib/crm-config'

/**
 * Badge de etapa de PROPIEDAD. Lee color y label desde crm-config
 * (PROPERTY_STAGES) — fuente única. Distinto de StageBadge (que es de leads).
 *
 * Resuelve solo los dos casos que antes obligaban a cada pantalla a hacerlo a
 * mano: las etapas legacy que siguen viniendo de la base (`captacion`,
 * `con_ofertas`) y los estados alternativos (`alquilada`). Sin esto cada
 * llamador armaba su propio mapa, y ahí aparecía el drift: el picker de
 * propiedades tenía `reservada` en ámbar cuando el canónico es violeta.
 */
interface PropertyStageBadgeProps {
  stage: string
  className?: string
}

const FALLBACK = 'bg-gray-100 text-gray-600'

export function PropertyStageBadge({ stage, className }: PropertyStageBadgeProps) {
  const cfg =
    PROPERTY_STAGES[resolvePropertyStage(stage)] ?? PROPERTY_ALT_STATUSES[stage]
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full',
        cfg?.color ?? FALLBACK,
        className,
      )}
    >
      {cfg?.label ?? stage}
    </span>
  )
}
