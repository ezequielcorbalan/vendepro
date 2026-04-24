'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'
import NewExpenseModal from '@/components/expenses/NewExpenseModal'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/expenses')
      setExpenses(data.expenses || data || [])
    } catch { setExpenses([]) }
    setLoading(false)
  }

  const filtered = expenses.filter(e =>
    (e.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500">{expenses.length} gasto{expenses.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Nuevo gasto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar gastos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No hay gastos" description="Registrá un gasto para comenzar" action={<button onClick={() => setShowModal(true)} className="btn-primary">Nuevo gasto</button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vinculado a</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{e.category || '—'}</td>
                  <td className="px-4 py-3 font-medium text-red-600">-${Number(e.amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-500">{e.expense_date}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{e.linked_to || 'general'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NewExpenseModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}
