'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, TrendingUp, MapPin, Building2, User, DollarSign, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AlquiladasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('properties', '/properties?commercial_stage=vendida&operation_type=alquiler')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totalARS = properties.reduce((sum, p) => {
    if (p.asking_price && p.currency === 'ARS') return sum + Number(p.asking_price)
    return sum
  }, 0)
  const totalUSD = properties.reduce((sum, p) => {
    if (p.asking_price && p.currency === 'USD') return sum + Number(p.asking_price)
    return sum
  }, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Alquiladas</h1>
        <p className="text-gray-500 text-sm mt-1">{properties.length} propiedad{properties.length !== 1 ? 'es' : ''} alquilada{properties.length !== 1 ? 's' : ''}</p>
      </div>

      {properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center mb-2">
              <TrendingUp className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{properties.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total alquiladas</p>
          </div>
          {totalUSD > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="w-8 h-8 bg-[#ff007c]/10 rounded-lg flex items-center justify-center mb-2">
                <DollarSign className="w-4 h-4 text-[#ff007c]" />
              </div>
              <p className="text-xl font-bold text-gray-800">USD {totalUSD.toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Alquileres en USD</p>
            </div>
          )}
          {totalARS > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="w-8 h-8 bg-[#ff8017]/10 rounded-lg flex items-center justify-center mb-2">
                <DollarSign className="w-4 h-4 text-[#ff8017]" />
              </div>
              <p className="text-xl font-bold text-gray-800">$ {totalARS.toLocaleString('es-AR')}</p>
              <p className="text-xs text-gray-500 mt-0.5">Alquileres en ARS</p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades alquiladas</h2>
          <p className="text-gray-500">Aquí aparecerán las propiedades de alquiler cuando cambien a etapa "Vendida"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map(p => (
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
                          <DollarSign className="w-3 h-3" />{formatCurrency(Number(p.asking_price), p.currency || 'ARS')}
                        </span>
                      )}
                      {p.agent_name && <span className="text-gray-400">{p.agent_name}</span>}
                      {p.updated_at && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(p.updated_at)}</span>}
                    </div>
                  </div>
                  <div className="bg-cyan-100 text-cyan-700 text-[10px] font-medium px-2 py-1 rounded-full shrink-0">
                    Alquilada
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
