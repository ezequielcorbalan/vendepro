'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, Circle, Handshake, Loader2, Pencil, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import { RESERVATION_STAGES, type ReservationStage } from '@/lib/crm-config'
import { countdownLabel, formatYmd, type ReservationMilestone } from '@/lib/doc-portal'

interface Reservation {
  id: string
  stage: ReservationStage
  buyer_name: string | null
  offer_amount: number | null
  offer_currency: string
  reservation_date: string | null
  acceptance_deadline: string | null
  accepted_at: string | null
  boleto_date: string | null
  escritura_date: string | null
  delivery_date: string | null
  notes: string | null
  milestones: ReservationMilestone[]
}

interface Props {
  propertyId: string
  propertyAddress: string
}

const EMPTY_FORM = {
  buyer_name: '', offer_amount: '', offer_currency: 'USD', reservation_date: '',
  acceptance_deadline: '', boleto_date: '', escritura_date: '', delivery_date: '', notes: '',
}
type Form = typeof EMPTY_FORM

const todayYmd = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

/**
 * Reserva de la propiedad con sus plazos: aceptación, boleto, escritura y
 * entrega. Lo mismo que ve el propietario en su portal, con las acciones para
 * ir avanzando.
 */
export default function ReservationCard({ propertyId, propertyAddress }: Props) {
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('transactions', `/reservations?property_id=${encodeURIComponent(propertyId)}`)
      if (!res.ok) throw new Error()
      const list = (await res.json()) as Reservation[]
      setReservation(list.find(r => r.stage !== 'cancelada' && r.stage !== 'rechazada') ?? null)
      setError(false)
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  function openModal() {
    const r = reservation
    setForm(r ? {
      buyer_name: r.buyer_name ?? '',
      offer_amount: r.offer_amount != null ? String(r.offer_amount) : '',
      offer_currency: r.offer_currency || 'USD',
      reservation_date: r.reservation_date?.slice(0, 10) ?? '',
      acceptance_deadline: r.acceptance_deadline ?? '',
      boleto_date: r.boleto_date ?? '',
      escritura_date: r.escritura_date ?? '',
      delivery_date: r.delivery_date ?? '',
      notes: r.notes ?? '',
    } : { ...EMPTY_FORM, reservation_date: todayYmd() })
    setModalOpen(true)
  }

  async function save() {
    setSaving(true)
    const payload = {
      buyer_name: form.buyer_name.trim() || null,
      offer_amount: form.offer_amount ? Number(form.offer_amount) : null,
      offer_currency: form.offer_currency,
      reservation_date: form.reservation_date || null,
      acceptance_deadline: form.acceptance_deadline || null,
      boleto_date: form.boleto_date || null,
      escritura_date: form.escritura_date || null,
      delivery_date: form.delivery_date || null,
      notes: form.notes.trim() || null,
    }
    try {
      const res = reservation
        ? await apiFetch('transactions', '/reservations', { method: 'PUT', body: JSON.stringify({ id: reservation.id, ...payload }) })
        : await apiFetch('transactions', '/reservations', {
            method: 'POST',
            body: JSON.stringify({ ...payload, property_id: propertyId, property_address: propertyAddress }),
          })
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as any)?.error || 'No se pudo guardar')
      setModalOpen(false)
      toast(reservation ? 'Reserva actualizada' : 'Reserva cargada')
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSaving(false)
  }

  async function markAccepted() {
    if (!reservation) return
    setBusy(true)
    const res = await apiFetch('transactions', '/reservations', {
      method: 'PUT', body: JSON.stringify({ id: reservation.id, accepted_at: todayYmd() }),
    })
    if (res.ok) { toast('Oferta aceptada'); await load() } else toast('No se pudo guardar', 'error')
    setBusy(false)
  }

  async function advance(stage: ReservationStage, confirmText?: string) {
    if (!reservation) return
    if (confirmText) {
      const { confirmed } = await askConfirm({ title: confirmText, message: 'El cambio queda en el historial de la reserva.', confirmLabel: 'Confirmar', variant: stage === 'cancelada' ? 'danger' : 'default' })
      if (!confirmed) return
    }
    setBusy(true)
    const res = await apiFetch('transactions', '/reservations/stage', {
      method: 'PUT', body: JSON.stringify({ id: reservation.id, stage }),
    })
    if (res.ok) { toast(RESERVATION_STAGES[stage].label); await load() } else toast('No se pudo cambiar la etapa', 'error')
    setBusy(false)
  }

  if (loading) {
    return <Card className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></Card>
  }

  const stage = reservation ? RESERVATION_STAGES[reservation.stage] : null
  const next = reservation?.milestones.find(m => !m.done) ?? null
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Card>
      {confirmDialog}
      <WidgetHeader
        icon={<Handshake className="w-4 h-4" />}
        title="Reserva"
        subtitle={reservation
          ? [reservation.buyer_name, reservation.offer_amount != null ? `${reservation.offer_currency} ${reservation.offer_amount.toLocaleString('es-AR')}` : null].filter(Boolean).join(' · ') || 'Sin datos del comprador'
          : 'Plazos de la operación: el propietario los ve en su portal'}
        badge={stage ? <StatusBadge label={stage.label} color={stage.color} /> : undefined}
        className="mb-4"
        action={reservation ? (
          <Button variant="ghost" size="icon" aria-label="Editar reserva" onClick={openModal}>
            <Pencil className="w-4 h-4" />
          </Button>
        ) : undefined}
      />

      {error && <Text size="sm" tone="danger">No se pudo cargar la reserva.</Text>}

      {!error && !reservation && (
        <Button variant="outline" fullWidth icon={<CalendarClock className="w-4 h-4" />} onClick={openModal}>
          Cargar reserva
        </Button>
      )}

      {reservation && (
        <div className="space-y-4">
          <ol className="space-y-2">
            {reservation.milestones.map(m => (
              <li key={m.key} className="flex items-center gap-2">
                {m.done
                  ? <Check className="w-4 h-4 text-success shrink-0" aria-label="Hecho" />
                  : <Circle className={`w-4 h-4 shrink-0 ${m.overdue ? 'text-danger' : 'text-gray-300'}`} aria-label="Pendiente" />}
                <Text size="sm" tone={m.done ? 'muted' : 'default'} className="flex-1">{m.label}</Text>
                {m.date && <Text size="xs" tone="muted">{formatYmd(m.date)}</Text>}
                {!m.done && m.days_left !== null && (
                  <Badge tone={m.overdue ? 'danger' : m === next && m.days_left <= 7 ? 'warning' : 'neutral'}>
                    {countdownLabel(m.days_left)}
                  </Badge>
                )}
                {!m.done && !m.date && <Badge tone="neutral">Sin fecha</Badge>}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            {reservation.stage === 'reservada' && !reservation.accepted_at && (
              <Button variant="outline" size="sm" loading={busy} onClick={markAccepted}>El propietario aceptó</Button>
            )}
            {stage?.next && stage.nextLabel && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => advance(stage.next as ReservationStage, `¿${stage.nextLabel}?`)}>
                {stage.nextLabel}
              </Button>
            )}
            {(reservation.stage === 'reservada' || reservation.stage === 'boleto' || reservation.stage === 'escritura') && (
              <Button variant="ghost" size="sm" icon={<X className="w-3.5 h-3.5" />} className="text-danger" disabled={busy}
                onClick={() => advance('cancelada', '¿Cancelar la reserva?')}>
                Cancelar reserva
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={reservation ? 'Editar reserva' : 'Cargar reserva'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={save}>Guardar</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Comprador">
            <Input value={form.buyer_name} onChange={set('buyer_name')} placeholder="Nombre de quien reserva" />
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Oferta">
              <Input type="number" inputMode="decimal" value={form.offer_amount} onChange={set('offer_amount')} placeholder="150000" />
            </Field>
            <Field label="Moneda">
              <Select value={form.offer_currency} onChange={set('offer_currency')}>
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </Select>
            </Field>
          </div>
          <Field label="Fecha de la reserva">
            <Input type="date" value={form.reservation_date} onChange={set('reservation_date')} />
          </Field>
          <Text size="xs" weight="semibold" tone="muted">Plazos previstos — el propietario ve la cuenta regresiva</Text>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Plazo para aceptar">
              <Input type="date" value={form.acceptance_deadline} onChange={set('acceptance_deadline')} />
            </Field>
            <Field label="Firma del boleto">
              <Input type="date" value={form.boleto_date} onChange={set('boleto_date')} />
            </Field>
            <Field label="Escritura">
              <Input type="date" value={form.escritura_date} onChange={set('escritura_date')} />
            </Field>
            <Field label="Entrega de llaves">
              <Input type="date" value={form.delivery_date} onChange={set('delivery_date')} />
            </Field>
          </div>
          <Field label="Notas">
            <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Escribano, condiciones, seña…" />
          </Field>
        </div>
      </Modal>
    </Card>
  )
}
