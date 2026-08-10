import {
  Phone,
  Users,
  Home,
  Eye,
  ClipboardList,
  RefreshCw,
  FileText,
  FileSignature,
  Calendar,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENT_TYPES, type EventType } from '@/lib/crm-config'

/**
 * Chip de tipo de evento del calendario. Color, ícono y label salen de
 * EVENT_TYPES (crm-config) — fuente única. Cambiás algo ahí y se refleja acá.
 */
const ICONS: Record<string, LucideIcon> = {
  Phone,
  Users,
  Home,
  Eye,
  ClipboardList,
  RefreshCw,
  FileText,
  FileSignature,
  Calendar,
}

interface EventChipProps {
  type: EventType
  /** Oculta el ícono y muestra solo el color + label. */
  hideIcon?: boolean
  className?: string
}

export function EventChip({ type, hideIcon = false, className }: EventChipProps) {
  const cfg = EVENT_TYPES[type]
  const Icon = ICONS[cfg.icon] ?? Calendar
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        cfg.bg,
        cfg.color,
        className,
      )}
    >
      {!hideIcon && <Icon className="w-3.5 h-3.5" aria-hidden />}
      {cfg.label}
    </span>
  )
}
