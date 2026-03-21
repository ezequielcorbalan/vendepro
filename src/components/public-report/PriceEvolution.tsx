'use client'

import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react'

interface PriceEntry {
  price: number
  currency: string
  reason: string | null
  created_at: string
}

export default function PriceEvolution({
  history,
  currentPrice,
  currency,
}: {
  history: PriceEntry[]
  currentPrice: number
  currency: string
}) {
  if (history.length === 0) return null

  const firstPrice = history[history.length - 1]?.price || currentPrice
  const totalChange = currentPrice - firstPrice
  const totalPct = firstPrice > 0 ? ((totalChange / firstPrice) * 100).toFixed(1) : '0'

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

  return (
    <section className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span className="w-1 h-6 bg-[#ff8017] rounded-full"></span>
        Evolución del precio
      </h2>

      {/* Summary */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
        <div className="flex-1">
          <p className="text-xs text-gray-500">Precio inicial</p>
          <p className="font-semibold text-gray-800">{currency} {firstPrice.toLocaleString('es-AR')}</p>
        </div>
        <div className="text-center">
          {totalChange !== 0 ? (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              totalChange < 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
              {totalChange < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {totalChange > 0 ? '+' : ''}{totalPct}%
            </div>
          ) : (
            <span className="text-xs text-gray-400">Sin cambios</span>
          )}
        </div>
        <div className="flex-1 text-right">
          <p className="text-xs text-gray-500">Precio actual</p>
          <p className="font-semibold text-brand-pink">{currency} {currentPrice.toLocaleString('es-AR')}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {history.map((entry, i) => {
          const prev = history[i + 1]
          const diff = prev ? entry.price - prev.price : 0
          const pct = prev && prev.price > 0 ? ((diff / prev.price) * 100).toFixed(1) : null

          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-xs text-gray-400 w-16 flex-shrink-0">{formatDate(entry.created_at)}</span>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                diff < 0 ? 'bg-green-100' : diff > 0 ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <DollarSign className={`w-3 h-3 ${
                  diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-500' : 'text-gray-400'
                }`} />
              </div>
              <span className="font-medium text-gray-800">
                {entry.currency} {entry.price.toLocaleString('es-AR')}
              </span>
              {pct && (
                <span className={`text-xs ${diff < 0 ? 'text-green-600' : 'text-red-500'}`}>
                  ({diff > 0 ? '+' : ''}{pct}%)
                </span>
              )}
              {entry.reason && (
                <span className="text-xs text-gray-400 truncate">— {entry.reason}</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
