'use client'

import { useState, useEffect } from 'react'
import { DollarSign, TrendingUp, MapPin, User, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'

export default function VendidasPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('transactions', '/sold-properties')
      .then(r => r.json() as Promise<any>)
      .then(d => { setSales(Array.isArray(d) ? d : (d.sales || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalUSD = sales.reduce((sum, s) => {
    if (s.sale_price && (s.currency === 'USD' || !s.currency)) return sum + Number(s.sale_price)
    return sum
  }, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Vendidas</h1>
        <p className="text-gray-500 text-sm mt-1">{sales.length} propiedad{sales.length !== 1 ? 'es' : ''} vendida{sales.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary */}
      {sales.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{sales.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total vendidas</p>
          </div>
          {totalUSD > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="w-8 h-8 bg-[#ff007c]/10 rounded-lg flex items-center justify-center mb-2">
                <DollarSign className="w-4 h-4 text-[#ff007c]" />
              </div>
              <p className="text-xl font-bold text-gray-800">USD {totalUSD.toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Facturación total</p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades vendidas</h2>
          <p className="text-gray-500">Las propiedades vendidas aparecerán aquí cuando se cierren ventas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map(s => (
            <div key={s.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate mb-1">{s.address || s.property_address}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {s.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.neighborhood}</span>}
                    {s.buyer_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />Comprador: {s.buyer_name}</span>}
                    {s.sale_price && (
                      <span className="font-medium text-[#ff007c]">{formatCurrency(Number(s.sale_price), s.currency || 'USD')}</span>
                    )}
                    {s.sold_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(s.sold_at)}</span>}
                    {s.agent_name && <span className="text-gray-400">{s.agent_name}</span>}
                  </div>
                  {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
                </div>
                <div className="bg-green-100 text-green-700 text-[10px] font-medium px-2 py-1 rounded-full shrink-0">
                  Vendida
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
