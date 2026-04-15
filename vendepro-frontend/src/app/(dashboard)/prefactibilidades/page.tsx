'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Calculator, MapPin, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function PrefactibilidadesPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('properties', '/prefactibilidades')
      .then(r => (r.json()) as any)
      .then((d: any) => {
        if (d?.error) { setError(true); setLoading(false); return }
        const list = Array.isArray(d) ? d : (Array.isArray(d?.prefactibilidades) ? d.prefactibilidades : [])
        setItems(list)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Prefactibilidades</h1>
          <p className="text-sm text-gray-500">Análisis de factibilidad de proyectos</p>
        </div>
        <Link
          href="/prefactibilidades/nueva"
          className="flex items-center gap-2 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:bg-[#e0006e] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-6">
          Error cargando prefactibilidades
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calculator className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-gray-500 font-medium mb-1">Sin prefactibilidades</h3>
          <p className="text-sm text-gray-400 mb-4">Creá tu primer análisis de factibilidad</p>
          <Link
            href="/prefactibilidades/nueva"
            className="flex items-center gap-2 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:bg-[#e0006e] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva prefactibilidad
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item: any) => (
            <Link
              key={item.id}
              href={`/prefactibilidades/${item.id}`}
              className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:border-[#ff007c]/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#ff007c]/10 flex items-center justify-center flex-shrink-0">
                <Calculator className="w-5 h-5 text-[#ff007c]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{item.project_name || 'Sin nombre'}</p>
                {item.address && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {item.address}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
