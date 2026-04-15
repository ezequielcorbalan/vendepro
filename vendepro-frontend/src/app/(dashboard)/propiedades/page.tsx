'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Plus, Search, Filter, MapPin, DollarSign } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PROPERTY_STAGES, type PropertyStage } from '@/lib/crm-config'
import { formatCurrency } from '@/lib/utils'

const PROPERTY_TYPES: Record<string, string> = {
  departamento: 'Departamento', casa: 'Casa', ph: 'PH',
  local: 'Local', terreno: 'Terreno', oficina: 'Oficina',
}

export default function PropiedadesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState('')

  useEffect(() => {
    apiFetch('properties', '/properties')
      .then(r => r.json() as Promise<any>)
      .then(d => { setProperties(Array.isArray(d) ? d : (d.properties || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = properties.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      if (!((p.address || '').toLowerCase().includes(q) ||
            (p.owner_name || '').toLowerCase().includes(q) ||
            (p.neighborhood || '').toLowerCase().includes(q))) return false
    }
    if (filterStage && p.stage !== filterStage) return false
    return true
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Propiedades</h1>
          <p className="text-gray-500 text-sm mt-1">{properties.length} propiedad{properties.length !== 1 ? 'es' : ''}</p>
        </div>
        <Link href="/propiedades/nueva" className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nueva propiedad
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="Buscar por dirección, propietario, barrio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todas las etapas</option>
          {Object.entries(PROPERTY_STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades</h2>
          <p className="text-gray-500 mb-4">Creá tu primera propiedad para empezar a generar reportes</p>
          <Link href="/propiedades/nueva" className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const stageCfg = PROPERTY_STAGES[p.stage as PropertyStage]
            return (
              <Link key={p.id} href={`/propiedades/${p.id}`}
                className="block bg-white border rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-800 truncate">{p.address}</h3>
                      {stageCfg && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${stageCfg.color}`}>{stageCfg.label}</span>
                      )}
                      {p.property_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PROPERTY_TYPES[p.property_type] || p.property_type}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {p.neighborhood && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.neighborhood}</span>}
                      {p.owner_name && <span>Propietario: {p.owner_name}</span>}
                      {p.asking_price && (
                        <span className="flex items-center gap-1 text-[#ff007c] font-medium">
                          <DollarSign className="w-3 h-3" />{formatCurrency(p.asking_price, p.currency)}
                        </span>
                      )}
                      {p.agent_name && <span className="text-gray-400">{p.agent_name}</span>}
                    </div>
                  </div>
                  {p.cover_photo && (
                    <img src={p.cover_photo} alt={p.address} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
