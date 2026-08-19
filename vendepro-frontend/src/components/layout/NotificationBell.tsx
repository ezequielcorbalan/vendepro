'use client'
import { useState, useEffect } from 'react'
import { Bell, AlertTriangle, Clock, X } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { Text } from '@/components/ui/Typography'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string
  urgency: 'high' | 'medium' | 'low'
}

// Ícono y color por urgencia. Los colores salen de los tokens semánticos del
// DS (danger/warning/info), no de la paleta Tailwind suelta.
const URGENCY = {
  high: { Icon: AlertTriangle, tone: 'text-danger' },
  medium: { Icon: Clock, tone: 'text-warning' },
  low: { Icon: Bell, tone: 'text-info' },
} as const

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

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

  const active = notifications.filter(n => !dismissed.has(n.id))
  const hasUrgent = active.some(n => n.urgency === 'high')

  return (
    <Dropdown
      align="left"
      // El panel de notificaciones no es un menú de ítems: ancho fijo y filas
      // full-width, así que anulamos el padding del contenedor.
      className="w-72 sm:w-80 p-0 overflow-hidden"
      trigger={
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className={hasUrgent ? 'w-5 h-5 text-danger' : active.length > 0 ? 'w-5 h-5 text-gray-600' : 'w-5 h-5 text-gray-400'} />
          {active.length > 0 && (
            <span
              className={`absolute top-0.5 right-0.5 w-4 h-4 text-[9px] font-bold text-white rounded-full flex items-center justify-center ${hasUrgent ? 'bg-danger' : 'bg-primary'}`}
            >
              {active.length}
            </span>
          )}
        </Button>
      }
    >
      <div
        className="px-4 py-3 border-b border-gray-100 flex items-center justify-between"
        // El Dropdown cierra al clickear su contenido (comportamiento de menú);
        // el header no navega, así que no debe cerrarlo.
        onClick={e => e.stopPropagation()}
      >
        <Text size="sm" weight="semibold">Notificaciones</Text>
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {active.length === 0 ? (
          <div className="p-6 text-center">
            <Text size="sm" tone="muted">Sin notificaciones</Text>
          </div>
        ) : (
          active.map(n => {
            const { Icon, tone } = URGENCY[n.urgency] ?? URGENCY.low
            return (
              <Link
                key={n.id}
                href={n.link}
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
              >
                <Icon className={`w-4 h-4 ${tone} mt-0.5 shrink-0`} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <Text
                    size="sm"
                    weight={n.urgency === 'high' ? 'medium' : 'normal'}
                    className={`truncate ${n.urgency === 'high' ? 'text-danger' : 'text-gray-700'}`}
                  >
                    {n.title}
                  </Text>
                  <Text size="xs" tone="muted" className="truncate">{n.body}</Text>
                </div>
                <button
                  type="button"
                  aria-label="Descartar notificación"
                  onClick={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDismissed(prev => new Set([...prev, n.id]))
                  }}
                  className="p-1 text-gray-300 hover:text-gray-500 shrink-0"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </Link>
            )
          })
        )}
      </div>
    </Dropdown>
  )
}
