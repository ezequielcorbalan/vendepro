'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'
import NewPaymentModal from '@/components/payments/NewPaymentModal'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/payments')
      setPayments(data.payments || data || [])
    } catch { setPayments([]) }
    setLoading(false)
  }

  async function toggleStatus(id: string) {
    try {
      await apiFetch(`/payments/${id}/toggle-status`, { method: 'PUT' })
      load()
    } catch {}
  }

  const filtered = payments.filter(p =>
    (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.rental_alias || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cobros</h1>
          <p className="text-sm text-gray-500">{payments.length} cobro{payments.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Nuevo cobro
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar cobros..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No hay cobros" description="Registrá un cobro para comenzar" action={<button onClick={() => setShowModal(true)} className="btn-primary">Nuevo cobro</button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Contrato</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.description || p.payment_type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.rental_alias || p.rental_id}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_type}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">${Number(p.amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-500">{p.payment_date}</td>
                  <td className="px-4 py-3"><Badge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(p.id)} className="text-xs text-gray-400 hover:text-gray-700 underline">
                      {p.status === 'pagado' ? 'Pendiente' : 'Pagado'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NewPaymentModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}
