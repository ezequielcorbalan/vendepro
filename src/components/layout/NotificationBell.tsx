'use client'
import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, Clock, X } from 'lucide-react'
import Link from 'next/link'

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

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data.notifications) setNotifications(data.notifications)
      })
      .catch(() => {})

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetch('/api/notifications')
        .then(r => r.json() as Promise<any>)
        .then(data => { if (data.notifications) setNotifications(data.notifications) })
        .catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Close on click outside
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
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
        <Bell className={`w-5 h-5 ${hasUrgent ? 'text-red-500' : active.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
        {active.length > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 w-4.5 h-4.5 text-[9px] font-bold text-white rounded-full flex items-center justify-center ${hasUrgent ? 'bg-red-500' : 'bg-pink-500'}`}>
            {active.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
            {active.length > 0 && (
              <button onClick={() => setDismissed(new Set(notifications.map(n => n.id)))} className="text-[10px] text-gray-400 hover:text-gray-600">
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {active.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">Sin notificaciones</div>
            ) : (
              active.map(n => (
                <Link key={n.id} href={n.link} onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors">
                  {n.urgency === 'high' ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> :
                   n.urgency === 'medium' ? <Clock className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" /> :
                   <Bell className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.urgency === 'high' ? 'text-red-700 font-medium' : 'text-gray-700'} truncate`}>{n.title}</p>
                    <p className="text-xs text-gray-400 truncate">{n.body}</p>
                  </div>
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); setDismissed(prev => new Set([...prev, n.id])) }}
                    className="p-1 text-gray-300 hover:text-gray-500 shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
