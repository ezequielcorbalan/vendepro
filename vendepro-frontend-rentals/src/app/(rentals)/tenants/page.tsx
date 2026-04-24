'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'
import NewTenantModal from '@/components/modals/NewTenantModal'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/tenants')
      setTenants(data.tenants || data || [])
    } catch { setTenants([]) }
    setLoading(false)
  }

  const filtered = tenants.filter(t =>
    `${t.name} ${t.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (t.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inquilinos</h1>
          <p className="text-sm text-gray-500">{tenants.length} inquilino{tenants.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Nuevo inquilino
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar inquilinos..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No hay inquilinos" description="Agregá un inquilino para comenzar" action={<button onClick={() => setShowModal(true)} className="btn-primary">Nuevo inquilino</button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">DNI/CUIT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/tenants/${t.id}`} className="font-medium text-gray-900 hover:text-pink-600">
                      {t.name} {t.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{t.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{t.dni_cuit || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <NewTenantModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load() }} />}
    </div>
  )
}
