'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Trash2, Loader2, BookUser, Phone, Mail, MapPin, X } from 'lucide-react'

const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 w-full'

const typeLabels: Record<string, { label: string; color: string }> = {
  vendedor: { label: 'Vendedor', color: 'bg-blue-100 text-blue-700' },
  comprador: { label: 'Comprador', color: 'bg-green-100 text-green-700' },
  inversor: { label: 'Inversor', color: 'bg-purple-100 text-purple-700' },
  inquilino: { label: 'Inquilino', color: 'bg-orange-100 text-orange-700' },
  otro: { label: 'Otro', color: 'bg-gray-100 text-gray-700' },
}

export default function ContactosPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', contact_type: 'vendedor', neighborhood: '', notes: '', source: 'manual',
  })

  function loadContacts() {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (filterType) params.set('type', filterType)
    fetch(`/api/contacts?${params}`).then(r => r.json()).then(data => {
      setContacts(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadContacts() }, [search, filterType])

  async function handleSave() {
    if (!form.full_name) return
    setSaving(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as any
    if (data.id) {
      setContacts(prev => [{ ...form, id: data.id, created_at: new Date().toISOString() }, ...prev])
      setForm({ full_name: '', phone: '', email: '', contact_type: 'vendedor', neighborhood: '', notes: '', source: 'manual' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Contactos</h1>
          <p className="text-sm text-brand-gray mt-1">Base de datos de clientes</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Nuevo contacto
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
            placeholder="Buscar por nombre, teléfono o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="vendedor">Vendedores</option>
          <option value="comprador">Compradores</option>
          <option value="inversor">Inversores</option>
          <option value="inquilino">Inquilinos</option>
        </select>
      </div>

      {/* New contact modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo contacto</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className={inputClass} placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                  <option value="vendedor">Vendedor</option>
                  <option value="comprador">Comprador</option>
                  <option value="inversor">Inversor</option>
                  <option value="inquilino">Inquilino</option>
                  <option value="otro">Otro</option>
                </select>
                <input className={inputClass} placeholder="Barrio" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
              </div>
              <textarea className={`${inputClass} h-20`} placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.full_name} className="flex-1 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : contacts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <BookUser className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-gray mb-4">{search ? 'Sin resultados' : 'No hay contactos todavía'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map(c => {
            const t = typeLabels[c.contact_type] || typeLabels.otro
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{c.full_name}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.color}`}>{t.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-[#ff007c]">
                          <Phone className="w-3 h-3" />{c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="text-xs text-gray-500 flex items-center gap-1 hover:text-[#ff007c]">
                          <Mail className="w-3 h-3" />{c.email}
                        </a>
                      )}
                      {c.neighborhood && <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{c.neighborhood}</span>}
                    </div>
                    {c.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
