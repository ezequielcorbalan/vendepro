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
  kind: string
  title: string
  body: string | null
  link_url: string | null
  read: boolean
}

// El backend guarda un `kind`, el panel pinta por urgencia: vencido es rojo,
// lo asignado/reservado amarillo, lo informativo azul.
const KIND_URGENCY: Record<string, UrgencyLevel> = {
  task_overdue: 'high',
  lead_assigned: 'medium',
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
      // El endpoint vive en api-admin y devuelve el array plano (sin envolver).
      const res = await apiFetch('admin', '/notifications')
      const data = (await res.json()) as any
      const list: Notification[] = Array.isArray(data) ? data : (data?.notifications ?? [])
      setNotifications(list.filter(n => !n.read))
    } catch {}
  }

  // Descartar = marcar leída en el backend; si el PUT falla, el descarte local
  // igual vale para esta sesión y el próximo load la vuelve a traer.
  function dismiss(ids: string[]) {
    setDismissed(prev => new Set([...prev, ...ids]))
    for (const id of ids) {
      apiFetch('admin', `/notifications/${id}/read`, { method: 'PUT' }).catch(() => {})
    }
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
    body: n.body ?? '',
    href: n.link_url ?? '#',
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
            action={{ label: 'Limpiar', onClick: () => dismiss(active.map(n => n.id)) }}
            onDismiss={id => dismiss([id])}
            onItemClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
