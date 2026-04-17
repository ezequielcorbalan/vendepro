'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Building2, Plus, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { fetchPropertyConfig } from '@/lib/property-config'
import type { PropertyConfig } from '@/lib/property-config'
import PropertyFilters from '@/components/properties/PropertyFilters'

export default function PropiedadesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [config, setConfig] = useState<PropertyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('properties', '/properties').then(r => r.json() as Promise<any>),
      fetchPropertyConfig(),
    ])
      .then(([d, cfg]) => {
        if (d?.error) { setError(true); setLoading(false); return }
        setProperties(Array.isArray(d) ? d : [])
        setConfig(cfg)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Propiedades</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Cargando...' : `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <Link href="/propiedades/nueva"
          className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva propiedad
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-6">Error cargando propiedades</div>
      )}

      {!loading && !error && properties.length === 0 && (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades</h2>
          <p className="text-sm text-gray-500 mb-4">Creá tu primera propiedad captada</p>
          <Link href="/propiedades/nueva"
            className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Link>
        </div>
      )}

      {!loading && !error && properties.length > 0 && config && (
        <PropertyFilters properties={properties} config={config} />
      )}
    </div>
  )
}
