'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import EmptyState from '@/components/shared/EmptyState'

export default function OtherIncomePage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ description: '', category: '', income_date: new Date().toISOString().slice(0,10), amount: '', payment_method: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/other-income')
      setItems(data.other_income || data || [])
    } catch { setItems([]) }
    setLoading(false)
  }

  async function save() {
    if (!form.description || !form.amount) return
    setSaving(true)
    try {
      await apiFetch('/other-income', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) })
      setShowForm(false)
      setForm({ description: '', category: '', income_date: new Date().toISOString().slice(0,10), amount: '', payment_method: '', notes: '' })
      load()
    } catch {} finally { setSaving(false) }
  }

  const filtered = items.filter(i =>
    (i.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Otros ingresos</h1>
          <p className="text-sm text-gray-500">{items.length} ingreso{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={15} /> Nuevo ingreso</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Nuevo ingreso</h2>
            <div className="space-y-3">
              <div><label className="label">Descripción *</label><input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
              <div><label className="label">Categoría</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                  <option value="">Sin categoría</option>
                  {['honorarios','comision','intereses','otros'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Fecha</label><input type="date" className="input" value={form.income_date} onChange={e => setForm(f => ({...f, income_date: e.target.value}))} /></div>
              <div><label className="label">Monto *</label><input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} /></div>
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
            <input className="input pl-9" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="text-center py-16 text-gray-400 text-sm">Cargando...</div>
        : filtered.length === 0 ? <EmptyState title="No hay ingresos adicionales" />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Descripción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.description}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{i.category || '—'}</td>
                  <td className="px-4 py-3 font-medium text-green-600">${Number(i.amount).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-500">{i.income_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
