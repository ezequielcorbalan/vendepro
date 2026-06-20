'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, DollarSign, Plus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PriceChange {
  id: string
  price_usd: number
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
    try {
      await apiFetch('properties', `/properties/${propertyId}/price-change`, {
        method: 'POST',
        body: JSON.stringify({ price_usd: parsed, reason: reason || null }),
      })
      onPriceChanged(parsed)
      setNewPrice('')
      setReason('')
      setShowModal(false)
      load()
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
              <DollarSign className="w-4.5 h-4.5 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Historial de precio</h2>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs text-brand-pink font-medium hover:underline"
          >
            <Plus className="w-3 h-3" /> Ajustar
          </button>
        </div>

        <div className="bg-gradient-to-br from-brand-pink/5 to-brand-orange/5 rounded-xl p-4 mb-3 border border-brand-pink/20">
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
              const prev = history[i + 1]
              const delta = prev ? ((h.price_usd - prev.price_usd) / prev.price_usd) * 100 : 0
              return (
                <div key={h.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1.5">
                  <div>
                    <p className="font-medium text-gray-700">USD {Number(h.price_usd).toLocaleString('es-AR')}</p>
                    <p className="text-gray-400">{new Date(h.changed_at).toLocaleDateString('es-AR')}{h.reason ? ` · ${h.reason}` : ''}</p>
                  </div>
                  {prev && (
                    <span className={`flex items-center gap-0.5 font-medium ${delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1.5" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ajustar precio</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nuevo precio (USD)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ej: Ajuste de mercado"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none"
                  />
                </div>
              </div>

              <button
                onClick={submitChange}
                disabled={!newPrice || saving}
                className="mt-5 w-full bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
