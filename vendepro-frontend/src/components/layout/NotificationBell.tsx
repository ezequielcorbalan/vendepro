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
type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string
  urgency: UrgencyLevel
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  async function loadNotifications() {
    try {
      const res = await apiFetch('crm', '/notifications')
      const data = (await res.json()) as any
      if (data.notifications) setNotifications(data.notifications)
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
    body: n.body,
    href: n.link,
    urgency: n.urgency,
  }))

  return (
    <div ref={ref} className="relative">
      <BellButton
        count={active.length}
        urgent={active.some(n => n.urgency === 'high')}
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
