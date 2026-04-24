'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import Badge from '@/components/shared/Badge'
import EmptyState from '@/components/shared/EmptyState'

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/invoices')
      setInvoices(data.invoices || data || [])
    } catch { setInvoices([]) }
    setLoading(false)
  }

  const filtered = invoices.filter(i =>
    (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.concept || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500">{invoices.length} factura{invoices.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar facturas..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        : filtered.length === 0 ? <EmptyState title="No hay facturas emitidas" />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nro.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.invoice_number || `#${i.id.slice(0,8)}`}</td>
                  <td className="px-4 py-3 text-gray-600">{i.invoice_type || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.issue_date}</td>
                  <td className="px-4 py-3 text-gray-600">{i.concept || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">${Number(i.total).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3"><Badge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
