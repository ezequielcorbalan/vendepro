'use client'
import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, Clock, X } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { URGENCY_TONES } from '@/lib/crm-config'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  link: string
  urgency: 'high' | 'medium' | 'low'
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
  const hasUrgent = active.some(n => n.urgency === 'high')

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        aria-label="Notificaciones"
        className="relative"
      >
        <Bell className={`w-5 h-5 ${hasUrgent ? 'text-danger' : active.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
        {active.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4 h-4 text-[9px] font-bold text-white rounded-full flex items-center justify-center ${hasUrgent ? 'bg-danger' : 'bg-primary'}`}>
            {active.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-card shadow-pop border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <Text weight="semibold">Notificaciones</Text>
            {active.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}
                className="text-[10px] text-gray-400 px-1.5 py-0.5"
              >
                Limpiar
              </Button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {active.length === 0 ? (
              <Text size="sm" tone="muted" className="p-6 text-center">Sin notificaciones</Text>
            ) : (
              // El botón de descartar va como HERMANO del Link, no adentro: un
              // <button> dentro de un <a> es HTML inválido y rompe la
              // navegación por teclado.
              active.map(n => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                >
                  <Link
                    href={n.link}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 flex-1 min-w-0"
                  >
                    {n.urgency === 'high' ? <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${URGENCY_TONES.high.icon}`} /> :
                     n.urgency === 'medium' ? <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${URGENCY_TONES.medium.icon}`} /> :
                     <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${URGENCY_TONES.low.icon}`} />}
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm truncate ${URGENCY_TONES[n.urgency]?.title ?? 'text-gray-700'}`}>{n.title}</span>
                      <span className="block text-xs text-gray-400 truncate">{n.body}</span>
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Descartar: ${n.title}`}
                    onClick={() => setDismissed(prev => new Set([...prev, n.id]))}
                    className="p-1 text-gray-300 hover:text-gray-500 shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
