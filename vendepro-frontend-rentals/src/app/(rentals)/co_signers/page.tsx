'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'

export default function CoSignersPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', last_name: '', email: '', phone: '', dni_cuit: '', guarantee_property_address: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/co-signers')
      setItems(data.co_signers || data || [])
    } catch { setItems([]) }
    setLoading(false)
  }

  async function save() {
    if (!form.name || !form.last_name) return
    setSaving(true)
    try {
      await apiFetch('/co-signers', { method: 'POST', body: JSON.stringify(form) })
      setShowForm(false)
      setForm({ name: '', last_name: '', email: '', phone: '', dni_cuit: '', guarantee_property_address: '', notes: '' })
      load()
    } catch {} finally { setSaving(false) }
  }

  const filtered = items.filter(i =>
    `${i.name} ${i.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Garantes</h1>
          <p className="text-sm text-gray-500">{items.length} garante{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={15} /> Nuevo garante</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nuevo garante</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} /></div>
                <div><label className="label">Apellido *</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} /></div>
              </div>
              <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
              <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} /></div>
              <div><label className="label">DNI / CUIT</label><input className="input" value={form.dni_cuit} onChange={e => setForm(f => ({...f, dni_cuit: e.target.value}))} /></div>
              <div><label className="label">Dirección propiedad en garantía</label><input className="input" value={form.guarantee_property_address} onChange={e => setForm(f => ({...f, guarantee_property_address: e.target.value}))} /></div>
              <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-secondary flex-1" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary flex-1" disabled={saving} onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar garantes..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        : filtered.length === 0 ? <EmptyState title="No hay garantes" action={<button onClick={() => setShowForm(true)} className="btn-primary">Nuevo garante</button>} />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">DNI/CUIT</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Propiedad garantía</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.name} {i.last_name}</td>
                  <td className="px-4 py-3 text-gray-500">{i.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.dni_cuit || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{i.guarantee_property_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
