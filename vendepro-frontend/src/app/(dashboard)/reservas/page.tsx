'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Handshake, Plus, DollarSign, MapPin, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
}

export default function ReservasPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('transactions', '/reservations')
      .then(r => r.json() as Promise<any>)
      .then(d => { setReservations(Array.isArray(d) ? d : (d.reservations || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Reservas</h1>
          <p className="text-gray-500 text-sm mt-1">{reservations.length} reserva{reservations.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/propiedades/pipeline" className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva reserva
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <Handshake className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin reservas</h2>
          <p className="text-gray-500">Las reservas se crean desde el pipeline de propiedades</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservations.map(r => {
            const st = statusLabels[r.status] || statusLabels.active
            return (
              <div key={r.id} className="bg-white border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-800 truncate">{r.property_address || r.address}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {r.buyer_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />Comprador: {r.buyer_name}</span>}
                      {r.reservation_price && <span className="flex items-center gap-1 text-[#ff007c] font-medium"><DollarSign className="w-3 h-3" />{formatCurrency(r.reservation_price, r.currency)}</span>}
                      {r.created_at && <span>{formatDate(r.created_at)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
