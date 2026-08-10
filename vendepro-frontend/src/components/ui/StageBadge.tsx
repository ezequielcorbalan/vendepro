import { cn } from '@/lib/utils'
import { getStageConfig } from '@/lib/crm-config'

/**
 * Badge de etapa del lead. NO define colores propios: los toma de
 * crm-config (LEAD_STAGES / BUYER_LEAD_STAGES) vía getStageConfig, que es la
 * fuente única. Cambiás el color de una etapa ahí y se actualiza en toda la app.
 */
interface StageBadgeProps {
  stage: string
  /** 'vendedor' (default) o 'comprador' — elige el set de etapas. */
  pipeline?: 'vendedor' | 'comprador' | null
  /** Muestra un punto del color de la etapa a la izquierda. */
  dot?: boolean
  className?: string
}

export function StageBadge({ stage, pipeline, dot = false, className }: StageBadgeProps) {
  const cfg = getStageConfig(stage, pipeline)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        cfg.color,
        className,
      )}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: cfg.dot }}
          aria-hidden
        />
      )}
      {cfg.label}
    </span>
  )
}
