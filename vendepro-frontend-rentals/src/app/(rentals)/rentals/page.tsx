'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, FileText } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'

export default function RentalsPage() {
  const [rentals, setRentals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/rentals')
      setRentals(data.rentals || data || [])
    } catch { setRentals([]) }
    setLoading(false)
  }

  const filtered = rentals.filter(r =>
    r.alias?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500">{rentals.length} contrato{rentals.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/rentals/new" className="btn-primary">
          <Plus size={15} /> Nuevo contrato
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar contratos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No hay contratos"
            description="Creá tu primer contrato para comenzar"
            action={<Link href="/rentals/new" className="btn-primary">Nuevo contrato</Link>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Alias</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Precio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Venc.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/rentals/${r.id}`} className="font-medium text-gray-900 hover:text-pink-600">{r.alias}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{r.rental_type}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.currency} ${Number(r.current_price).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.start_date}</td>
                  <td className="px-4 py-3 text-gray-500">{r.end_date}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
