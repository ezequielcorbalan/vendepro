'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Handshake, MapPin, Building2, User, DollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

export default function ReservasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('properties', '/properties?commercial_stage=reservada')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Reservas</h1>
        <p className="text-gray-500 text-sm mt-1">{properties.length} propiedad{properties.length !== 1 ? 'es' : ''} en reserva</p>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <Handshake className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades en reserva</h2>
          <p className="text-gray-500">Aquí aparecerán las propiedades cuando cambien a etapa "Reservada"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map(p => {
            const opType = p.operation_type ?? 'venta'
            return (
              <Link key={p.id} href={`/propiedades/${p.id}`}>
                <div className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate mb-1">{p.address}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {p.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</span>}
                        {p.property_type && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.property_type}</span>}
                        {p.owner_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{p.owner_name}</span>}
                        {p.asking_price && (
                          <span className="flex items-center gap-1 font-semibold text-[#ff007c]">
                            <DollarSign className="w-3 h-3" />{formatCurrency(Number(p.asking_price), p.currency || 'USD')}
                          </span>
                        )}
                        {p.agent_name && <span className="text-gray-400">{p.agent_name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded-full">Reservada</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${opType === 'alquiler' ? 'bg-cyan-100 text-cyan-700' : 'bg-indigo-50 text-indigo-600'}`}>
                        {opType === 'alquiler' ? 'Alquiler' : 'Venta'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
