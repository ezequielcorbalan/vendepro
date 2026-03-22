'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, DollarSign } from 'lucide-react'

export default function VendidasPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    address: '', neighborhood: '', property_type: 'departamento', rooms: '',
    total_area: '', sold_price: '', original_price: '', currency: 'USD',
    sold_date: '', days_on_market: '',
  })

  useEffect(() => {
    fetch('/api/sold-properties').then(r => r.json()).then(data => {
      setProperties(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!form.address || !form.neighborhood) return
    setSaving(true)
    const res = await fetch('/api/sold-properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as any
    if (data.id) {
      setProperties(prev => [{ ...form, id: data.id, created_at: new Date().toISOString() }, ...prev])
      setForm({ address: '', neighborhood: '', property_type: 'departamento', rooms: '', total_area: '', sold_price: '', original_price: '', currency: 'USD', sold_date: '', days_on_market: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta propiedad vendida?')) return
    await fetch(`/api/sold-properties?id=${id}`, { method: 'DELETE' })
    setProperties(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Propiedades vendidas</h1>
          <p className="text-sm text-brand-gray mt-1">Base de datos interna de ventas y reservas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nueva venta
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 space-y-4">
          <h2 className="font-medium text-gray-800">Registrar venta</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" placeholder="Dirección *" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="text" placeholder="Barrio *" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <select value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="departamento">Departamento</option>
              <option value="casa">Casa</option>
              <option value="ph">PH</option>
              <option value="local">Local</option>
              <option value="terreno">Terreno</option>
              <option value="oficina">Oficina</option>
            </select>
            <input type="number" placeholder="Ambientes" value={form.rooms} onChange={e => setForm(f => ({ ...f, rooms: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="number" placeholder="m² totales" value={form.total_area} onChange={e => setForm(f => ({ ...f, total_area: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="number" placeholder="Precio publicación USD" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="number" placeholder="Precio venta USD" value={form.sold_price} onChange={e => setForm(f => ({ ...f, sold_price: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="date" placeholder="Fecha venta" value={form.sold_date} onChange={e => setForm(f => ({ ...f, sold_date: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
            <input type="number" placeholder="Días en cartera" value={form.days_on_market} onChange={e => setForm(f => ({ ...f, days_on_market: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-gray">No hay propiedades vendidas registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-500">Dirección</th>
                  <th className="text-left p-3 font-medium text-gray-500">Barrio</th>
                  <th className="text-center p-3 font-medium text-gray-500">m²</th>
                  <th className="text-center p-3 font-medium text-gray-500">Precio venta</th>
                  <th className="text-center p-3 font-medium text-gray-500">USD/m²</th>
                  <th className="text-center p-3 font-medium text-gray-500">Días</th>
                  <th className="text-center p-3 font-medium text-gray-500">Fecha</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {properties.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{p.address}</td>
                    <td className="p-3 text-gray-500">{p.neighborhood}</td>
                    <td className="text-center p-3">{p.total_area || '-'}</td>
                    <td className="text-center p-3 font-semibold text-green-600">
                      {p.sold_price ? `USD ${Number(p.sold_price).toLocaleString('es-AR')}` : '-'}
                    </td>
                    <td className="text-center p-3">
                      {p.sold_price && p.total_area ? Math.round(p.sold_price / p.total_area).toLocaleString('es-AR') : '-'}
                    </td>
                    <td className="text-center p-3">{p.days_on_market || '-'}</td>
                    <td className="text-center p-3 text-gray-500">{p.sold_date || '-'}</td>
                    <td className="p-3">
                      <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
