'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/services')
      setServices(data.services || data || [])
    } catch { setServices([]) }
    setLoading(false)
  }

  const filtered = services.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.provider || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Servicios</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar servicios..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No hay servicios" description="Los servicios se crean al configurar un contrato" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Servicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nro. cuenta</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.provider || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.account_number || '—'}</td>
                  <td className="px-4 py-3"><Badge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
