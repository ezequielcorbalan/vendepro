'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, UserPlus, Phone, Mail, MapPin, ChevronRight, X, ArrowRight } from 'lucide-react'

const STAGES = [
  { key: 'nuevo', label: 'Nuevo', color: 'bg-blue-500' },
  { key: 'contactado', label: 'Contactado', color: 'bg-yellow-500' },
  { key: 'calificado', label: 'Calificado', color: 'bg-orange-500' },
  { key: 'tasacion', label: 'En tasación', color: 'bg-purple-500' },
  { key: 'captado', label: 'Captado', color: 'bg-green-500' },
  { key: 'publicado', label: 'Publicado', color: 'bg-emerald-600' },
  { key: 'perdido', label: 'Perdido', color: 'bg-gray-400' },
]

const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 w-full'

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list')
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', source: 'manual', source_detail: '',
    property_address: '', neighborhood: '', property_type: 'departamento',
    operation: 'venta', stage: 'nuevo', notes: '', estimated_value: '',
  })

  useEffect(() => {
    fetch('/api/leads').then(r => r.json()).then(data => {
      setLeads(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!form.full_name) return
    setSaving(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as any
    if (data.id) {
      setLeads(prev => [{ ...form, id: data.id, created_at: new Date().toISOString() }, ...prev])
      setForm({ full_name: '', phone: '', email: '', source: 'manual', source_detail: '', property_address: '', neighborhood: '', property_type: 'departamento', operation: 'venta', stage: 'nuevo', notes: '', estimated_value: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function updateStage(id: string, newStage: string) {
    const lead = leads.find(l => l.id === id)
    if (!lead) return
    await fetch('/api/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, stage: newStage }),
    })
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage: newStage } : l))
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este lead?')) return
    await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const stageCount = (stage: string) => leads.filter(l => l.stage === stage).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Leads</h1>
          <p className="text-sm text-brand-gray mt-1">Pipeline de prospectos</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs rounded-md transition ${viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Lista</button>
            <button onClick={() => setViewMode('kanban')} className={`px-3 py-1.5 text-xs rounded-md transition ${viewMode === 'kanban' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Kanban</button>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo lead
          </button>
        </div>
      </div>

      {/* New lead form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Nuevo lead</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inputClass} placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <input className={inputClass} placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputClass} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  <option value="manual">Manual</option>
                  <option value="zonaprop">ZonaProp</option>
                  <option value="argenprop">Argenprop</option>
                  <option value="mercadolibre">MercadoLibre</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="referido">Referido</option>
                  <option value="emblue">Emblue</option>
                  <option value="web">Sitio web</option>
                </select>
                <select className={inputClass} value={form.operation} onChange={e => setForm(f => ({ ...f, operation: e.target.value }))}>
                  <option value="venta">Venta</option>
                  <option value="alquiler">Alquiler</option>
                  <option value="tasacion">Tasación</option>
                </select>
              </div>
              <input className={inputClass} placeholder="Dirección propiedad" value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Barrio" value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))} />
                <input className={inputClass} type="number" placeholder="Valor estimado USD" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} />
              </div>
              <textarea className={`${inputClass} h-20`} placeholder="Notas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving || !form.full_name} className="flex-1 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar lead'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-gray mb-4">No hay leads todavía</p>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Agregar lead
          </button>
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="space-y-2">
          {/* Stage summary pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
            {STAGES.filter(s => stageCount(s.key) > 0).map(s => (
              <span key={s.key} className={`flex-shrink-0 text-xs font-medium text-white px-3 py-1 rounded-full ${s.color}`}>
                {s.label} ({stageCount(s.key)})
              </span>
            ))}
          </div>

          {leads.map(lead => {
            const stage = STAGES.find(s => s.key === lead.stage) || STAGES[0]
            const nextStage = STAGES[STAGES.findIndex(s => s.key === lead.stage) + 1]
            return (
              <div key={lead.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{lead.full_name}</h3>
                      <span className={`text-[10px] font-medium text-white px-2 py-0.5 rounded-full ${stage.color}`}>{stage.label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      {lead.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                      {lead.email && <span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                      {lead.neighborhood && <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.neighborhood}</span>}
                    </div>
                    {lead.property_address && <p className="text-xs text-gray-400 mt-1">{lead.property_address}</p>}
                    {lead.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{lead.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(lead.id)} className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {nextStage && lead.stage !== 'perdido' && (
                  <button
                    onClick={() => updateStage(lead.id, nextStage.key)}
                    className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition"
                  >
                    Avanzar a {nextStage.label} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* KANBAN VIEW */
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {STAGES.filter(s => s.key !== 'perdido').map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage.key)
            return (
              <div key={stage.key} className="flex-shrink-0 w-64 sm:w-72">
                <div className={`${stage.color} text-white rounded-t-xl px-3 py-2 text-sm font-medium flex items-center justify-between`}>
                  <span>{stage.label}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{stageLeads.length}</span>
                </div>
                <div className="bg-gray-50 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                  {stageLeads.map(lead => {
                    const nextStage = STAGES[STAGES.findIndex(s => s.key === lead.stage) + 1]
                    return (
                      <div key={lead.id} className="bg-white rounded-lg shadow-sm p-3">
                        <p className="font-medium text-sm text-gray-800 truncate">{lead.full_name}</p>
                        {lead.phone && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</p>}
                        {lead.property_address && <p className="text-xs text-gray-400 mt-1 truncate">{lead.property_address}</p>}
                        {lead.estimated_value && <p className="text-xs font-medium text-[#ff007c] mt-1">USD {Number(lead.estimated_value).toLocaleString('es-AR')}</p>}
                        {nextStage && (
                          <button onClick={() => updateStage(lead.id, nextStage.key)} className="w-full mt-2 text-[10px] font-medium text-indigo-600 bg-indigo-50 py-1.5 rounded hover:bg-indigo-100 flex items-center justify-center gap-1">
                            <ArrowRight className="w-3 h-3" /> {nextStage.label}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
