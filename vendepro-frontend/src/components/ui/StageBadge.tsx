import { cn } from '@/lib/utils'
import { getStageConfig } from '@/lib/crm-config'

/**
 * Badge de etapa del lead. NO define colores propios: los toma de
 * crm-config (LEAD_STAGES / BUYER_LEAD_STAGES) vía getStageConfig, que es la
 * fuente única. Cambiás el color de una etapa ahí y se actualiza en toda la app.
 */
export type StageBadgeSize = 'sm' | 'md'

interface StageBadgeProps {
  stage: string
  /** 'vendedor' (default) o 'comprador' — elige el set de etapas. */
  pipeline?: 'vendedor' | 'comprador' | null
  /** Muestra un punto del color de la etapa a la izquierda. */
  dot?: boolean
  /** 'sm' para contextos densos (kanban, tablas). Default 'md'. */
  size?: StageBadgeSize
  className?: string
}

const SIZE: Record<StageBadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
}

export function StageBadge({ stage, pipeline, dot = false, size = 'md', className }: StageBadgeProps) {
  const cfg = getStageConfig(stage, pipeline)
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        SIZE[size],
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
