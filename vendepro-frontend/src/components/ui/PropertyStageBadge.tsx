import { cn } from '@/lib/utils'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'

/**
 * Badge de etapa de PROPIEDAD. Lee color y label desde crm-config
 * (PROPERTY_STAGES) — fuente única. Distinto de StageBadge (que es de leads).
 */
interface PropertyStageBadgeProps {
  stage: string
  className?: string
}

const FALLBACK = 'bg-gray-100 text-gray-600'

export function PropertyStageBadge({ stage, className }: PropertyStageBadgeProps) {
  const cfg = PROPERTY_STAGES[stage as PropertyStage]
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
