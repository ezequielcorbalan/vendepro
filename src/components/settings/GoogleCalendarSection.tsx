'use client'
import { useState, useEffect } from 'react'
import { Calendar, Link2, Trash2 } from 'lucide-react'

export default function GoogleCalendarSection() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/google-calendar/status')
      .then(r => r.json() as Promise<any>)
      .then(d => { setStatus(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function disconnect() {
    if (!confirm('¿Desconectar Google Calendar?')) return
    await fetch('/api/google-calendar/status', { method: 'DELETE' })
    setStatus({ connected: false })
  }

  if (loading) return <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-24" />

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        Google Calendar
      </h2>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-800">Conectado</p>
              <p className="text-xs text-green-600">{status.google_email}</p>
            </div>
            <button onClick={disconnect} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Desconectar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Los eventos de tu Google Calendar aparecen automáticamente en el calendario del CRM.
            Cuando creás un evento en el CRM, también se sincroniza a Google Calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Conectá tu Google Calendar para ver tus eventos en el CRM y sincronizar automáticamente.
          </p>
          <div className="text-xs text-gray-400 space-y-1">
            <p>El CRM clasifica automáticamente tus eventos según palabras clave:</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {[
                { kw: 'llamada', type: 'Llamada' },
                { kw: 'reunión', type: 'Reunión' },
                { kw: 'visita', type: 'Visita' },
                { kw: 'tasación', type: 'Tasación' },
                { kw: 'seguimiento', type: 'Seguimiento' },
                { kw: 'firma', type: 'Firma' },
              ].map(({ kw, type }) => (
                <span key={kw} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">
                  &quot;{kw}&quot; → {type}
                </span>
              ))}
            </div>
            <p className="mt-2">También vincula eventos a leads/contactos si mencionás su nombre en el título.</p>
          </div>
          <a
            href="/api/auth/google"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Link2 className="w-4 h-4" /> Conectar Google Calendar
          </a>
        </div>
      )}
    </div>
  )
}
