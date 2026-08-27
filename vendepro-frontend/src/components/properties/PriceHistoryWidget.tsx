'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, DollarSign, Plus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
      <div className="bg-white rounded-card border border-gray-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Historial de precio</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Ajustar
          </button>
        </div>

        <div className="bg-primary/5 rounded-card p-4 mb-3 border border-primary/20">
          <p className="text-xs text-gray-500">Precio actual</p>
          <p className="text-2xl font-bold bg-gradient-to-br from-brand-pink to-brand-orange bg-clip-text text-transparent">
            {currentPrice ? `${currency} ${Number(currentPrice).toLocaleString('es-AR')}` : 'Sin precio'}
          </p>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Sin cambios de precio registrados</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 5).map((h, i) => {
              const prevPrice = h.previous_price_usd ?? history[i + 1]?.price_usd ?? null
              const delta = prevPrice ? ((h.price_usd - prevPrice) / prevPrice) * 100 : null
              return (
                <div key={h.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5">
                  <div>
                    <p className="font-medium text-gray-700">USD {Number(h.price_usd).toLocaleString('es-AR')}</p>
                    <p className="text-gray-400">{new Date(h.changed_at).toLocaleDateString('es-AR')}{h.reason ? ` · ${h.reason}` : ''}</p>
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
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-card shadow-pop max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1.5" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-ink">Ajustar precio</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                      <p className={`mt-1 flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-success' : 'text-danger'}`}>
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

              {error && (
                <p className="mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-control px-3 py-2">{error}</p>
              )}

              <Button onClick={submitChange} disabled={!newPrice} loading={saving} fullWidth className="mt-5">
                Guardar ajuste
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
