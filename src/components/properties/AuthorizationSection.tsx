'use client'
import { useState } from 'react'
import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function AuthorizationSection({
  propertyId,
  authStart,
  authDays,
}: {
  propertyId: string
  authStart: string | null
  authDays: number
}) {
  const { toast } = useToast()
  const [start, setStart] = useState(authStart || '')
  const [days, setDays] = useState(authDays || 180)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: propertyId, authorization_start: start || null, authorization_days: days }),
      })
      toast('Autorización actualizada', 'success')
    } catch { toast('Error', 'error') }
    finally { setSaving(false) }
  }

  // Calculate remaining days
  let daysRemaining: number | null = null
  let pctElapsed = 0
  let status: 'ok' | 'warning' | 'danger' | 'expired' | 'none' = 'none'

  if (start) {
    const startDate = new Date(start)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + days)
    const now = new Date()
    daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)
    const totalMs = endDate.getTime() - startDate.getTime()
    const elapsedMs = now.getTime() - startDate.getTime()
    pctElapsed = Math.min(Math.max(Math.round((elapsedMs / totalMs) * 100), 0), 100)

    if (daysRemaining <= 0) status = 'expired'
    else if (daysRemaining <= 15) status = 'danger'
    else if (daysRemaining <= 30) status = 'warning'
    else status = 'ok'
  }

  const statusColors = {
    ok: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    expired: 'bg-gray-400',
    none: 'bg-gray-200',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-6">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-purple-500" /> Autorización de venta
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Date input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fecha de inicio</label>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none"
          />
        </div>

        {/* Days input */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Duración (días)</label>
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none"
          />
        </div>

        {/* Save + Status */}
        <div className="flex items-end gap-3">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Visual countdown */}
      {start && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {status === 'expired' && <AlertTriangle className="w-4 h-4 text-red-500" />}
              {status === 'danger' && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
              {status === 'warning' && <Clock className="w-4 h-4 text-yellow-500" />}
              {status === 'ok' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              <span className={`text-sm font-medium ${
                status === 'expired' ? 'text-red-600' :
                status === 'danger' ? 'text-red-600' :
                status === 'warning' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {status === 'expired' ? 'AUTORIZACIÓN VENCIDA' :
                 daysRemaining !== null ? `${daysRemaining} días restantes` : ''}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(start).toLocaleDateString('es-AR')} → {new Date(new Date(start).getTime() + days * 86400000).toLocaleDateString('es-AR')}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${statusColors[status]}`}
              style={{ width: `${pctElapsed}%` }}
            />
          </div>
          {status === 'danger' && (
            <p className="text-xs text-red-500 mt-2 font-medium animate-pulse">
              ⚠️ ¡Quedan solo {daysRemaining} días! Renovar o cerrar operación.
            </p>
          )}
          {status === 'expired' && (
            <p className="text-xs text-red-600 mt-2 font-bold">
              La autorización venció hace {Math.abs(daysRemaining!)} días. Contactar al propietario para renovar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
