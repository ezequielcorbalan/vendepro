'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Search } from 'lucide-react'

const statusLabel: Record<string, string> = {
  active: 'Activas',
  sold: 'Vendidas',
  suspended: 'Pausadas',
  archived: 'Archivadas',
  inactive: 'Dadas de baja',
}
const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-pink-100 text-pink-700',
  suspended: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-500',
  inactive: 'bg-red-100 text-red-700',
}

export default function PropertyFilters({ properties }: { properties: any[] }) {
  const [filter, setFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')

  const filtered = properties.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      const hay = [p.address, p.neighborhood, p.owner_name, p.agent_name, p.property_type]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // Count by status
  const counts: Record<string, number> = {}
  for (const p of properties) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar dirección, barrio, propietario, agente..."
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] bg-white"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todas ({properties.length})
        </button>
        {Object.entries(counts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === status ? 'bg-gray-800 text-white' : statusColor[status] + ' hover:opacity-80'
            }`}
          >
            {statusLabel[status] || status} ({count})
          </button>
        ))}
      </div>

      {/* Property grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((property: any) => (
          <Link key={property.id} href={`/propiedades/${property.id}`} className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden ${property.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="h-40 bg-gradient-to-br from-brand-pink/20 to-brand-orange/20 flex items-center justify-center">
              <Building2 className="w-12 h-12 text-brand-pink/40" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[property.status] || 'bg-gray-100 text-gray-500'}`}>
                  {statusLabel[property.status]?.replace(/s$/, '') || property.status}
                </span>
                <span className="text-xs text-brand-gray">{property.report_count || 0} reportes</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{property.address}</h3>
              <p className="text-sm text-brand-gray">{property.neighborhood} · {property.property_type}</p>
              {property.asking_price && (
                <p className="text-sm font-medium text-brand-pink mt-2">{property.currency} {Number(property.asking_price).toLocaleString('es-AR')}</p>
              )}
              {property.agent_name && <p className="text-xs text-brand-gray mt-2">Agente: {property.agent_name}</p>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center shadow-sm">
          <p className="text-brand-gray">No hay propiedades con este filtro</p>
        </div>
      )}
    </div>
  )
}
