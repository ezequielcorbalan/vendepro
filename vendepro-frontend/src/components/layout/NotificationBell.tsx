'use client'
import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '@/lib/api'
import { Z } from '@/lib/z'
import {
  NotificationBell as BellButton,
  NotificationPanel,
  type NotificationItem,
} from '@/components/ui/Notifications'
import type { UrgencyLevel } from '@/lib/crm-config'

/**
 * Campana de la sidebar. Sólo datos y estado: qué trae la API, cada cuánto se
 * refresca, qué está descartado y si el panel está abierto. Cómo se ve lo define
 * el design system (`ui/Notifications`) — antes esto tenía su propia copia del
 * botón y del panel dibujados a mano.
 */
/** Fila de `notifications` tal cual la devuelve api-admin. */
type Notification = {
  id: string
  kind: 'lead_assigned' | 'task_overdue' | 'reservation_update' | 'system'
  title: string
  body: string | null
  link_url: string | null
  read: boolean
}

/** Un lead delegado o una tarea vencida piden acción; el resto es informativo. */
const KIND_URGENCY: Record<Notification['kind'], UrgencyLevel> = {
  lead_assigned: 'high',
  task_overdue: 'high',
  reservation_update: 'medium',
  system: 'low',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  async function loadNotifications() {
    try {
      // El endpoint vive en api-admin y devuelve un array plano. Apuntaba a
      // api-crm y esperaba `{notifications}`: la campana nunca mostró nada.
      const res = await apiFetch('admin', '/notifications')
      const data = (await res.json()) as any
      if (Array.isArray(data)) setNotifications(data.filter((n: Notification) => !n.read))
    } catch {}
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const active = notifications.filter(n => !dismissed.has(n.id))
  const items: NotificationItem[] = active.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body ?? undefined,
    href: n.link_url ?? undefined,
    urgency: KIND_URGENCY[n.kind] ?? 'low',
  }))

  return (
    <div ref={ref} className="relative">
      <BellButton
        count={active.length}
        urgent={active.some(n => KIND_URGENCY[n.kind] === 'high')}
        onClick={() => setOpen(o => !o)}
      />

      {open && (
        <div className="absolute left-0 top-full mt-2" style={{ zIndex: Z.dropdown }}>
          <NotificationPanel
            items={items}
            action={{ label: 'Limpiar', onClick: () => setDismissed(new Set(notifications.map(n => n.id))) }}
            onDismiss={id => setDismissed(prev => new Set([...prev, id]))}
            onItemClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
