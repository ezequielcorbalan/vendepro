import { Bell } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Campana de notificaciones + panel del design system.
 * NotificationBell: botón con punto rojo si hay sin leer.
 * NotificationPanel: lista; los ítems no leídos llevan fondo primario tenue + punto.
 */
interface NotificationBellProps {
  hasUnread?: boolean
  onClick?: () => void
  className?: string
}

export function NotificationBell({ hasUnread = false, onClick, className }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Notificaciones"
      className={cn(
        'relative w-10 h-10 rounded-control bg-white border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50',
        className,
      )}
    >
      <Bell className="w-5 h-5" />
      {hasUnread && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger border-2 border-white" />
      )}
    </button>
  )
}

export interface NotificationItem {
  id: string
  text: ReactNode
  time: string
  unread?: boolean
}

interface NotificationPanelProps {
  items: NotificationItem[]
  onMarkAllRead?: () => void
  className?: string
}

export function NotificationPanel({ items, onMarkAllRead, className }: NotificationPanelProps) {
  return (
    <div className={cn('w-[300px] bg-white border border-gray-200 rounded-card shadow-pop overflow-hidden', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-ink">Notificaciones</span>
        {onMarkAllRead && (
          <button onClick={onMarkAllRead} className="text-xs font-medium text-primary hover:underline">
            Marcar leídas
          </button>
        )}
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {items.map(n => (
          <li
            key={n.id}
            className={cn('flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0', n.unread && 'bg-primary/[0.03]')}
          >
            <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', n.unread ? 'bg-primary' : 'bg-transparent')} />
            <div>
              <div className="text-sm text-ink">{n.text}</div>
              <div className="text-xs text-gray-400 mt-0.5">{n.time}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
