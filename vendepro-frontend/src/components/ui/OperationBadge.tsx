import { cn } from '@/lib/utils'
import { OPERATION_TYPES, type OperationType } from '@/lib/crm-config'

/**
 * Badge de tipo de operación (Venta/Alquiler/Tasación/Otro). Color y label
 * desde crm-config (OPERATION_TYPES) — fuente única.
 */
interface OperationBadgeProps {
  operation: string
  className?: string
}

const FALLBACK = 'bg-gray-100 text-gray-700'

export function OperationBadge({ operation, className }: OperationBadgeProps) {
  const cfg = OPERATION_TYPES[operation as OperationType]
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full',
        cfg?.color ?? FALLBACK,
        className,
      )}
    >
      {cfg?.label ?? operation}
    </span>
  )
}
