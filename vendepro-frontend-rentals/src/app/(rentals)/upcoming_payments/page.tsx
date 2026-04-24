'use client'

import { useEffect, useState } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'

export default function UpcomingPaymentsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/upcoming-payments')
      setItems(data.upcoming_payments || data || [])
    } catch { setItems([]) }
    setLoading(false)
  }

  const filtered = items.filter(u =>
    (u.rental_alias || u.period || '').toLowerCase().includes(search.toLowerCase())
  )

  const pending = filtered.filter(u => u.status === 'pendiente' || u.status === 'vencido')
  const paid = filtered.filter(u => u.status === 'cobrado')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle size={18} className="text-orange-500" />
        <h1 className="text-xl font-semibold text-gray-900">Cobros pendientes</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{pending.length} pendiente{pending.length !== 1 ? 's' : ''}</p>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sin cobros pendientes" description="Todos los cobros están al día" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Contrato</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimiento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto esperado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.rental_alias || u.rental_id}</td>
                  <td className="px-4 py-3 text-gray-600">{u.period}</td>
                  <td className="px-4 py-3 text-gray-500">{u.expected_date}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">${Number(u.expected_amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3"><Badge status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
