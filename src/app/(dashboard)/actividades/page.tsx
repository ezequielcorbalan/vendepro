'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, Activity, Phone, Users, Calendar, Eye, ClipboardList, Home, X, CheckCircle } from 'lucide-react'

const ACTIVITY_TYPES = [
  { key: 'llamada', label: 'Llamada', icon: Phone, color: 'bg-blue-100 text-blue-700' },
  { key: 'reunion', label: 'Reunión', icon: Users, color: 'bg-purple-100 text-purple-700' },
  { key: 'visita', label: 'Visita propiedad', icon: Home, color: 'bg-green-100 text-green-700' },
  { key: 'tasacion', label: 'Tasación', icon: ClipboardList, color: 'bg-orange-100 text-orange-700' },
  { key: 'seguimiento', label: 'Seguimiento', icon: Eye, color: 'bg-yellow-100 text-yellow-700' },
  { key: 'admin', label: 'Administrativa', icon: Calendar, color: 'bg-gray-100 text-gray-700' },
]

const inputClass = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 w-full'

export default function ActividadesPage() {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'llamada', description: '', scheduled_at: '', completed_at: '',
  })

  useEffect(() => {
    fetch('/api/activities').then(r => r.json()).then(data => {
      setActivities(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json() as any
    if (data.id) {
      setActivities(prev => [{ ...form, id: data.id, created_at: new Date().toISOString() }, ...prev])
      setForm({ activity_type: 'llamada', description: '', scheduled_at: '', completed_at: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  // Count by type for today
  const today = new Date().toISOString().split('T')[0]
  const todayActivities = activities.filter(a => a.created_at?.startsWith(today) || a.completed_at?.startsWith(today))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Actividad</h1>
          <p className="text-sm text-brand-gray mt-1">Registro de actividades del equipo</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Registrar actividad
        </button>
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
        {ACTIVITY_TYPES.map(at => {
          const count = todayActivities.filter(a => a.activity_type === at.key).length
          const Icon = at.icon
          return (
            <div key={at.key} className="bg-white rounded-xl shadow-sm p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1 text-gray-400" />
              <p className="text-lg font-bold text-gray-800">{count}</p>
              <p className="text-[9px] sm:text-[10px] text-gray-500">{at.label}</p>
            </div>
          )
        })}
      </div>

      {/* New activity modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Nueva actividad</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACTIVITY_TYPES.map(at => {
                  const Icon = at.icon
                  return (
                    <button
                      key={at.key}
                      onClick={() => setForm(f => ({ ...f, activity_type: at.key }))}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition ${
                        form.activity_type === at.key ? 'border-[#ff007c] bg-[#ff007c]/5 text-[#ff007c]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {at.label}
                    </button>
                  )
                })}
              </div>
              <textarea className={`${inputClass} h-20`} placeholder="Descripción de la actividad..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Programada para</label>
                  <input className={inputClass} type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Completada</label>
                  <input className={inputClass} type="datetime-local" value={form.completed_at} onChange={e => setForm(f => ({ ...f, completed_at: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Activity list */}
      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-gray">No hay actividades registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(a => {
            const at = ACTIVITY_TYPES.find(t => t.key === a.activity_type) || ACTIVITY_TYPES[0]
            const Icon = at.icon
            const isCompleted = !!a.completed_at
            return (
              <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-green-100' : at.color.split(' ')[0]}`}>
                  {isCompleted ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${at.color}`}>{at.label}</span>
                    {a.agent_name && <span className="text-[10px] text-gray-400">{a.agent_name}</span>}
                    {a.lead_name && <span className="text-[10px] text-indigo-500">{a.lead_name}</span>}
                  </div>
                  {a.description && <p className="text-sm text-gray-700 mt-1">{a.description}</p>}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(a.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
