'use client'

import { useState } from 'react'
import { Banknote, Pencil } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { StatTile } from '@/components/ui/StatTile'
import { Alert } from '@/components/ui/Alert'

interface Props {
  propertyId: string
  soldPrice: number | null
  soldDate: string | null
  commissionAmount: number | null
  commissionCurrency: string | null
  commissionUsdRate: number | null
  /**
   * % pactado en la tasación de esta propiedad. Prellena el importe sugerido.
   * Hoy la API de propiedades todavía no lo devuelve — el dato vive dentro del
   * bloque de condiciones de la tasación — así que la sugerencia no aparece
   * hasta que se conecte. Queda listo del lado de la UI.
   */
  honorariosPct?: number | null
  onSaved: () => void
}

function fmt(value: number | null | undefined, currency = 'USD'): string {
  if (value == null) return '—'
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${currency} ${Math.round(value).toLocaleString('es-AR')}`
  }
}

/**
 * Cuánto cobró la inmobiliaria por esta operación.
 *
 * Es el número que cierra el ROI de la sección Marketing: sin él se sabe cuánto
 * cuesta un lead, pero no si el canal que lo trajo se paga solo.
 */
export default function IncomeWidget({
  propertyId, soldPrice, soldDate,
  commissionAmount, commissionCurrency, commissionUsdRate,
  honorariosPct, onSaved,
}: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const suggested = soldPrice && honorariosPct ? Math.round(soldPrice * honorariosPct) / 100 : null

  const [form, setForm] = useState({
    commission_amount: commissionAmount !== null ? String(commissionAmount) : (suggested !== null ? String(suggested) : ''),
    commission_currency: commissionCurrency ?? 'USD',
    usd_rate: commissionUsdRate !== null && commissionCurrency !== 'USD' ? String(commissionUsdRate) : '',
    sold_price: soldPrice !== null ? String(soldPrice) : '',
    sold_date: soldDate ?? '',
  })

  const loaded = commissionAmount !== null
  const pendingRate = loaded && commissionCurrency !== 'USD' && commissionUsdRate === null

  async function save() {
    if (form.commission_amount.trim() === '') {
      toast('Cargá los honorarios cobrados', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/income`, {
        method: 'PUT',
        body: JSON.stringify({
          commission_amount: Number(form.commission_amount),
          commission_currency: form.commission_currency,
          usd_rate: form.usd_rate === '' ? null : Number(form.usd_rate),
          sold_price: form.sold_price === '' ? null : Number(form.sold_price),
          sold_date: form.sold_date || null,
        }),
      })
      const body = (await res.json()) as any
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo guardar')

      toast(
        body.commission_usd_rate === null
          ? 'Ingreso guardado. No se pudo obtener la cotización: cargala a mano para que entre al ROI.'
          : 'Ingreso guardado',
        body.commission_usd_rate === null ? 'error' : 'success',
      )
      setOpen(false)
      onSaved()
    } catch (e: any) {
      toast(e?.message ?? 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <WidgetHeader
        icon={<Banknote className="w-4 h-4" />}
        title="Ingreso de la operación"
        subtitle="Lo que cobró la inmobiliaria — alimenta el ROI de Marketing"
        action={
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Pencil className="w-4 h-4" /> {loaded ? 'Editar' : 'Cargar'}
          </Button>
        }
      />

      {loaded ? (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <StatTile label="Honorarios" value={fmt(commissionAmount, commissionCurrency ?? 'USD')} />
          <StatTile label="Precio de venta" value={fmt(soldPrice)} />
        </div>
      ) : (
        <Text tone="muted" size="sm" className="mt-3">
          Todavía no se cargó cuánto entró por esta operación. Sin ese número, la pauta y los portales
          que la trajeron muestran costo pero no retorno.
        </Text>
      )}

      {pendingRate && (
        <Alert tone="warning" title="Falta la cotización" className="mt-3">
          <p>
            Los honorarios están en {commissionCurrency} y no se pudo obtener el dólar del día, así que
            esta operación no entra al ROI. Editá y cargá la cotización a mano.
          </p>
        </Alert>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ingreso de la operación"
        icon={<Banknote className="w-5 h-5" />}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Honorarios cobrados" required
              hint={suggested !== null && commissionAmount === null ? `Sugerido: ${fmt(suggested)} (${honorariosPct}% pactado)` : undefined}>
              <Input
                type="number" min="0" step="0.01"
                value={form.commission_amount}
                onChange={e => setForm(f => ({ ...f, commission_amount: e.target.value }))}
              />
            </Field>
            <Field label="Moneda">
              <Select value={form.commission_currency} onChange={e => setForm(f => ({ ...f, commission_currency: e.target.value }))}>
                <option value="USD">Dólares (USD)</option>
                <option value="ARS">Pesos (ARS)</option>
              </Select>
            </Field>
          </div>

          {form.commission_currency !== 'USD' && (
            <Field label="Cotización del dólar"
              hint="Se busca sola al guardar (dólar blue). Queda congelada con la operación: un cierre de julio tiene que seguir valiendo lo de julio.">
              <Input
                type="number" min="0" step="0.01"
                value={form.usd_rate}
                onChange={e => setForm(f => ({ ...f, usd_rate: e.target.value }))}
                placeholder="Automática"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta" hint="Opcional — el valor final de la operación">
              <Input
                type="number" min="0" step="0.01"
                value={form.sold_price}
                onChange={e => setForm(f => ({ ...f, sold_price: e.target.value }))}
              />
            </Field>
            <Field label="Fecha de cierre" hint="Opcional">
              <Input type="date" value={form.sold_date} onChange={e => setForm(f => ({ ...f, sold_date: e.target.value }))} />
            </Field>
          </div>

          <Text size="xs" tone="muted">
            El ingreso se atribuye al canal que trajo al comprador: el lead comprador marcado como
            cerrado en esta propiedad. Si no hay ninguno, entra al total pero no suma al ROI de ningún
            portal.
          </Text>
        </div>
      </Modal>
    </Card>
  )
}
