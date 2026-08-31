'use client'

import { useState } from 'react'
import { Calendar, Check } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Alert } from '@/components/ui/Alert'

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
    <Card className="relative overflow-hidden">
      <WidgetHeader
        icon={<Calendar className="w-4 h-4" />}
        title="Autorización de venta"
        className="mb-4"
      />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="Fecha de inicio">
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        <Field label="Duración (días)">
          <Input type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} placeholder="180" />
        </Field>
      </div>

      {remainingDays !== null && (
        <Alert tone={remainingDays < 0 ? 'danger' : remainingDays < 15 ? 'warning' : 'brand'}>
          {remainingDays < 0
            ? `Vencida hace ${Math.abs(remainingDays)} días`
            : `${remainingDays} días restantes`}
        </Alert>
      )}

      {/* Ni `fullWidth` ni el visto como carácter: una barra rosa a todo el
          ancho para guardar un formulario secundario pesa más que la acción, y
          el visto va como ícono de lucide. */}
      <div className="mt-3 flex justify-end">
        <Button
          onClick={save}
          loading={saving}
          icon={saved ? <Check className="w-4 h-4" /> : undefined}
        >
          {saved ? 'Guardado' : 'Guardar'}
        </Button>
      </div>
    </Card>
  )
}
