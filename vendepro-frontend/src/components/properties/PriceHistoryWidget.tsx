'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, DollarSign, Plus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { StatTile } from '@/components/ui/StatTile'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Text } from '@/components/ui/Typography'

interface PriceChange {
  id: string
  price_usd: number
  previous_price_usd: number | null
  reason: string | null
  changed_at: string
}

interface Props {
  propertyId: string
  currentPrice: number | null
  currency: string
  onPriceChanged: (newPrice: number) => void
}

export default function PriceHistoryWidget({
  propertyId,
  currentPrice,
  currency,
  onPriceChanged,
}: Props) {
  const [history, setHistory] = useState<PriceChange[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  async function load() {
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/price-history`)
      const data = (await res.json()) as any
      if (Array.isArray(data?.history)) setHistory(data.history)
      else if (Array.isArray(data)) setHistory(data)
    } catch { /* noop */ }
  }

  async function submitChange() {
    const parsed = parseFloat(newPrice)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/price-change`, {
        method: 'POST',
        body: JSON.stringify({ price: parsed, reason: reason || null }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as any
        setError(data?.error || 'No se pudo guardar el ajuste')
        return
      }
      onPriceChanged(parsed)
      setNewPrice('')
      setReason('')
      setShowModal(false)
      load()
    } catch {
      setError('No se pudo guardar el ajuste')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <WidgetHeader
          icon={<DollarSign className="w-4 h-4" />}
          title="Historial de precio"
          className="mb-4"
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowModal(true)} icon={<Plus className="w-3 h-3" />}>
              Ajustar
            </Button>
          }
        />

        <StatTile
          tone="primary"
          label="Precio actual"
          value={currentPrice ? `${currency} ${Number(currentPrice).toLocaleString('es-AR')}` : 'Sin precio'}
          className="mb-3"
        />

        {history.length === 0 ? (
          <Text size="xs" tone="muted" className="text-center py-2">Sin cambios de precio registrados</Text>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((h, i) => {
              const prevPrice = h.previous_price_usd ?? history[i + 1]?.price_usd ?? null
              const delta = prevPrice ? ((h.price_usd - prevPrice) / prevPrice) * 100 : null
              return (
                <div key={h.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5">
                  <div>
                    <Text size="xs" weight="medium">USD {Number(h.price_usd).toLocaleString('es-AR')}</Text>
                    <Text size="xs" tone="muted">{new Date(h.changed_at).toLocaleDateString('es-AR')}{h.reason ? ` · ${h.reason}` : ''}</Text>
                  </div>
                  {delta !== null && delta !== 0 && (
                    <span className={`flex items-center gap-0.5 font-medium ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                      {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Ajustar precio"
        icon={<DollarSign className="w-4 h-4" />}
        footer={
          <Button onClick={submitChange} disabled={!newPrice} loading={saving} fullWidth>
            Guardar ajuste
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Nuevo precio (USD)">
            <Input
              type="number"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              placeholder="0"
            />
            {(() => {
              const parsed = parseFloat(newPrice)
              if (!currentPrice || !parsed || parsed <= 0) return null
              const delta = ((parsed - currentPrice) / currentPrice) * 100
              if (delta === 0) return null
              return (
                <p className={`mt-1 flex items-center gap-0.5 text-[11px] font-medium ${delta > 0 ? 'text-success' : 'text-danger'}`}>
                  {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}% respecto del precio actual
                </p>
              )
            })()}
          </Field>
          <Field label="Motivo (opcional)">
            <Input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Ajuste de mercado"
            />
          </Field>
        </div>

        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      </Modal>
    </>
  )
}
