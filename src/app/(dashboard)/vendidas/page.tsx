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
    sold_date: '', days_on_market: '', listing_url: '',
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
      setForm({ address: '', neighborhood: '', property_type: 'departamento', rooms: '', total_area: '', sold_price: '', original_price: '', currency: 'USD', sold_date: '', days_on_market: '', listing_url: '' })
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Propiedades vendidas</h1>
          <p className="text-sm text-brand-gray mt-1">Base de datos interna de ventas y reservas</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 self-start sm:self-auto"
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
          <input type="url" placeholder="Link ficha (ZonaProp, ArgenProp...)" value={form.listing_url} onChange={e => setForm(f => ({ ...f, listing_url: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 w-full" />
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
        <div className="grid gap-3">
          {properties.map((p: any) => {
            const usdM2 = p.sold_price && p.total_area ? Math.round(p.sold_price / p.total_area) : null
            const discount = p.original_price && p.sold_price ? ((1 - p.sold_price / p.original_price) * 100).toFixed(1) : null
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{p.address}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{p.neighborhood} &middot; {p.property_type || 'Depto'} {p.total_area ? `\u00B7 ${p.total_area} m\u00B2` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {discount && Number(discount) > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">-{discount}%</span>
                    )}
                    <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-500 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {p.original_price && (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">Publicado</p>
                      <p className="text-xs font-medium text-gray-400 line-through">USD {Number(p.original_price).toLocaleString('es-AR')}</p>
                    </div>
                  )}
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400">Cierre</p>
                    <p className="text-xs font-bold text-green-600">{p.sold_price ? `USD ${Number(p.sold_price).toLocaleString('es-AR')}` : '-'}</p>
                  </div>
                  {usdM2 && (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">USD/m&sup2;</p>
                      <p className="text-xs font-semibold text-gray-700">{usdM2.toLocaleString('es-AR')}</p>
                    </div>
                  )}
                  {p.days_on_market && (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">D&iacute;as</p>
                      <p className="text-xs font-semibold text-gray-700">{p.days_on_market}</p>
                    </div>
                  )}
                  {p.sold_date && (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">Fecha</p>
                      <p className="text-xs font-semibold text-gray-700">{p.sold_date}</p>
                    </div>
                  )}
                </div>
                {p.listing_url && (
                  <a href={p.listing_url} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline mt-2 inline-block">
                    Ver ficha →
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
