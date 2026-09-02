'use client'

import { Bell, AlertTriangle, Clock, X } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { URGENCY_TONES, type UrgencyLevel } from '@/lib/crm-config'
import { cn } from '@/lib/utils'

/**
 * Campana de notificaciones + panel.
 *
 * Estos dos componentes son la ÚNICA definición de cómo se ve una notificación
 * en la app. Antes había dos: esta —que sólo usaba la galería, con un modelo
 * inventado de leído/no-leído— y otra escrita a mano en `layout/NotificationBell`
 * con el modelo real (urgencia + descartar + link). Ganó el modelo real: acá
 * está la forma, y `layout/NotificationBell` se quedó sólo con los datos
 * (fetch, polling, qué está descartado, abrir/cerrar).
 *
 * El estado abierto/cerrado NO vive acá a propósito: el `Dropdown` del DS cierra
 * con cualquier click adentro, que es lo correcto para un menú pero no para este
 * panel, donde se descartan varios ítems seguidos.
 */
interface NotificationBellProps {
  /** Notificaciones activas. 0 = campana apagada, sin globo. */
  count?: number
  /** Alguna es urgente: la campana y el globo pasan a `danger`. */
  urgent?: boolean
  /** `ghost` para barras (default, es el de la sidebar); `outline` suelta. */
  variant?: 'ghost' | 'outline'
  onClick?: () => void
  className?: string
}

export function NotificationBell({
  count = 0,
  urgent = false,
  variant = 'ghost',
  onClick,
  className,
}: NotificationBellProps) {
  return (
    <Button
      variant={variant}
      size="icon"
      onClick={onClick}
      aria-label={count > 0 ? `Notificaciones (${count})` : 'Notificaciones'}
      className={cn('relative', className)}
    >
      <Bell
        className={cn('w-5 h-5', urgent ? 'text-danger' : count > 0 ? 'text-gray-600' : 'text-gray-400')}
      />
      {count > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] font-bold text-white',
            urgent ? 'bg-danger' : 'bg-primary',
          )}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  )
}

export interface NotificationItem {
  id: string
  title: string
  /** Segunda línea, más chica. */
  body?: ReactNode
  /** Si se pasa, el ítem navega ahí. */
  href?: string
  /** Define el ícono y el color del título. El mapa vive en crm-config. */
  urgency?: UrgencyLevel
}

const URGENCY_ICON = { high: AlertTriangle, medium: Clock, low: Bell } as const

interface NotificationPanelProps {
  items: NotificationItem[]
  /** Acción del header (ej. "Limpiar"). Con la lista vacía no se muestra. */
  action?: { label: string; onClick: () => void }
  /** Si se pasa, cada ítem lleva una X para descartarlo. */
  onDismiss?: (id: string) => void
  /** Se dispara al clickear un ítem — para que el contenedor cierre el panel. */
  onItemClick?: () => void
  emptyLabel?: string
  className?: string
}

export function NotificationPanel({
  items,
  action,
  onDismiss,
  onItemClick,
  emptyLabel = 'Sin notificaciones',
  className,
}: NotificationPanelProps) {
  return (
    <div
      className={cn(
        'w-72 sm:w-80 bg-white border border-gray-200 rounded-card shadow-pop overflow-hidden',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <Text weight="semibold">Notificaciones</Text>
        {action && items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={action.onClick} className="text-xs text-gray-400">
            {action.label}
          </Button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <Text size="sm" tone="muted" className="block p-6 text-center">{emptyLabel}</Text>
        ) : (
          items.map(n => {
            const urgency = n.urgency ?? 'low'
            const Icon = URGENCY_ICON[urgency]
            const tone = URGENCY_TONES[urgency]
            const inner = (
              <>
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', tone.icon)} />
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-sm truncate', tone.title)}>{n.title}</span>
                  {n.body && <span className="block text-xs text-gray-400 truncate">{n.body}</span>}
                </span>
              </>
            )
            return (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                {/* La X va como HERMANA del Link, no adentro: un <button> dentro
                    de un <a> es HTML inválido y rompe la navegación por teclado. */}
                {n.href ? (
                  <Link href={n.href} onClick={onItemClick} className="flex items-start gap-3 flex-1 min-w-0">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 flex-1 min-w-0">{inner}</div>
                )}
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Descartar: ${n.title}`}
                    onClick={() => onDismiss(n.id)}
                    className="p-1 text-gray-300 hover:text-gray-500 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
