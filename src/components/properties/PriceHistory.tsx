'use client'

import { useState } from 'react'
import { DollarSign, TrendingDown, TrendingUp, Minus, Plus, History } from 'lucide-react'

interface PriceEntry {
  id: string
  price: number
  currency: string
  reason: string | null
  changed_by_name: string | null
  created_at: string
}

export default function PriceHistory({
  propertyId,
  currentPrice,
  currency,
  history,
}: {
  propertyId: string
  currentPrice: number
  currency: string
  history: PriceEntry[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [newPrice, setNewPrice] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<PriceEntry[]>(history)
  const [price, setPrice] = useState(currentPrice)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPrice) return
    setLoading(true)

    try {
      const res = await fetch(`/api/properties/${propertyId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: parseFloat(newPrice),
          currency,
          reason: reason || null,
        }),
      })

      if (res.ok) {
        const data = await res.json() as any
        setPrice(parseFloat(newPrice))
        setEntries([
          {
            id: data.id || Date.now().toString(),
            price: parseFloat(newPrice),
            currency,
            reason: reason || null,
            changed_by_name: 'Vos',
            created_at: new Date().toISOString(),
          },
          ...entries,
        ])
        setNewPrice('')
        setReason('')
        setShowForm(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const getPriceChange = (current: number, previous: number) => {
    const diff = current - previous
    const pct = ((diff / previous) * 100).toFixed(1)
    return { diff, pct, isUp: diff > 0 }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <History className="w-5 h-5 text-brand-orange" />
          Historial de precio
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1 text-sm text-brand-pink font-medium hover:underline"
        >
          <Plus className="w-4 h-4" />
          Ajustar precio
        </button>
      </div>

      {/* Current price */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <p className="text-xs text-gray-500 mb-1">Precio actual</p>
        <p className="text-2xl font-bold text-brand-pink">
          {currency} {price.toLocaleString('es-AR')}
        </p>
      </div>

      {/* Price change form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border border-brand-pink/20 bg-pink-50/50 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nuevo precio ({currency})</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={price.toString()}
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/30"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Motivo del ajuste (opcional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Sin consultas en 2 semanas, ajuste de mercado..."
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-pink text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar cambio'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* History timeline */}
      {entries.length > 0 ? (
        <div className="space-y-0">
          {entries.map((entry, i) => {
            const prev = entries[i + 1]
            const change = prev ? getPriceChange(entry.price, prev.price) : null

            return (
              <div key={entry.id} className="flex gap-3 pb-4 relative">
                {/* Timeline line */}
                {i < entries.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200"></div>
                )}
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  !change ? 'bg-gray-100' : change.isUp ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {!change ? (
                    <DollarSign className="w-4 h-4 text-gray-400" />
                  ) : change.isUp ? (
                    <TrendingUp className="w-4 h-4 text-red-500" />
                  ) : change.diff === 0 ? (
                    <Minus className="w-4 h-4 text-gray-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-green-600" />
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">
                      {entry.currency} {entry.price.toLocaleString('es-AR')}
                    </span>
                    {change && (
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        change.isUp ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {change.isUp ? '+' : ''}{change.pct}%
                      </span>
                    )}
                  </div>
                  {entry.reason && (
                    <p className="text-xs text-gray-500 mt-0.5">{entry.reason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(entry.created_at)}
                    {entry.changed_by_name && ` · ${entry.changed_by_name}`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">Sin cambios de precio registrados</p>
      )}
    </div>
  )
}
