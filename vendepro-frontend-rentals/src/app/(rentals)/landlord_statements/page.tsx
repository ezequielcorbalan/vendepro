'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Download } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'
import { API_BASE } from '@/lib/constants'
import { getAuthHeaders } from '@/lib/auth'

export default function LandlordStatementsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/landlord-statements')
      setItems(data.statements || data || [])
    } catch { setItems([]) }
    setLoading(false)
  }

  const filtered = items.filter(i =>
    (i.landlord_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.period || '').includes(search)
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Liquidaciones</h1>
          <p className="text-sm text-gray-500">{items.length} liquidacion{items.length !== 1 ? 'es' : ''}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por propietario o período..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        : filtered.length === 0 ? <EmptyState title="No hay liquidaciones" description="Las liquidaciones se generan desde el Resumen del mes" />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Propietario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Período</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ingresos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Gastos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Honorarios</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Neto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.landlord_name}</td>
                  <td className="px-4 py-3 text-gray-600">{i.period}</td>
                  <td className="px-4 py-3 text-green-700">${Number(i.total_income).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-red-600">${Number(i.total_expenses).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-orange-600">${Number(i.admin_fee_amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">${Number(i.net_amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3"><Badge status={i.status} /></td>
                  <td className="px-4 py-3">
                    <a
                      href={`${API_BASE}/landlord-statements/${i.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-pink-600"
                    >
                      <Download size={15} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
