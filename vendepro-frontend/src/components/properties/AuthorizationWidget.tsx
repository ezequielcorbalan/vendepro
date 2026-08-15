'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  propertyId: string
  authStartDate: string | null
  authDurationDays: number | null
  onUpdate: (values: { auth_start_date: string | null; auth_duration_days: number | null }) => void
}

export default function AuthorizationWidget({
  propertyId,
  authStartDate,
  authDurationDays,
  onUpdate,
}: Props) {
  const [startDate, setStartDate] = useState(authStartDate ?? '')
  const [durationDays, setDurationDays] = useState(String(authDurationDays ?? 180))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const remainingDays = (() => {
    if (!startDate || !durationDays) return null
    const start = new Date(startDate)
    const duration = parseInt(durationDays) || 0
    const end = new Date(start.getTime() + duration * 86400000)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000)
    return diff
  })()

  async function save() {
    setSaving(true)
    try {
      await apiFetch('properties', `/properties/${propertyId}`, {
        method: 'PUT',
        body: JSON.stringify({
          auth_start_date: startDate || null,
          auth_duration_days: parseInt(durationDays) || null,
        }),
      })
      onUpdate({
        auth_start_date: startDate || null,
        auth_duration_days: parseInt(durationDays) || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-card border border-gray-200 shadow-card p-5 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center">
          <Calendar className="w-4.5 h-4.5 text-white" />
        </div>
        <h2 className="text-sm font-semibold text-ink">Autorización de venta</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Fecha de inicio">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        <Field label="Duración (días)">
          <Input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="180" />
        </Field>
      </div>

      {remainingDays !== null && (
        <div className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${
          remainingDays < 0
            ? 'bg-red-50 text-red-700 border border-red-200'
            : remainingDays < 15
            ? 'bg-orange-50 text-orange-700 border border-orange-200'
            : 'bg-brand-pink/5 text-brand-pink border border-brand-pink/20'
        }`}>
          {remainingDays < 0 ? (
            <>
              <AlertCircle className="w-4 h-4" />
              Vencida hace {Math.abs(remainingDays)} días
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              {remainingDays} días restantes
            </>
          )}
        </div>
      )}

      <Button onClick={save} loading={saving} fullWidth className="mt-3">
        {saved ? '✓ Guardado' : 'Guardar'}
      </Button>
    </div>
  )
}
