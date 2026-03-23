'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, ArrowRight, X, Home, DollarSign, Calendar, Users, Handshake, CheckCircle } from 'lucide-react'

const STAGES = [
  { key: 'reservada', label: 'Reservada', color: 'bg-blue-100 text-blue-700' },
  { key: 'contraoferta', label: 'Contraoferta', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'rechazada', label: 'Rechazada', color: 'bg-red-100 text-red-700' },
  { key: 'aceptada_docs', label: 'Aceptada / Docs', color: 'bg-purple-100 text-purple-700' },
  { key: 'refuerzo', label: 'Refuerzo', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'legajos_regalos', label: 'Legajos / Regalos', color: 'bg-pink-100 text-pink-700' },
  { key: 'escriturada', label: 'Escriturada', color: 'bg-green-100 text-green-700' },
  { key: 'caida', label: 'Caida', color: 'bg-gray-100 text-gray-600' },
] as const

type StageKey = typeof STAGES[number]['key']

function getStageInfo(key: string) {
  return STAGES.find(s => s.key === key) || STAGES[0]
}

function getNextStage(current: string): string | null {
  const idx = STAGES.findIndex(s => s.key === current)
  if (idx === -1 || idx >= STAGES.length - 1) return null
  // Skip 'caida' in normal flow
  if (STAGES[idx + 1].key === 'caida') return null
  return STAGES[idx + 1].key
}

export default function ReservasPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [form, setForm] = useState({
    property_address: '', buyer_name: '', seller_name: '', agent_id: '',
    offer_amount: '', offer_currency: 'USD', reservation_date: '', notes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/reservations').then(r => r.json()).then(d => d as any),
      fetch('/api/profile').then(r => r.json()).then(d => d as any),
    ]).then(([res, profile]) => {
      setReservations(Array.isArray(res) ? res : [])
      // Try to load agents if admin
      if (profile?.role === 'admin' || profile?.role === 'owner') {
        fetch('/api/create-agent').then(r => r.json()).then(d => {
          const data = d as any
          setAgents(Array.isArray(data) ? data : [])
        }).catch(() => {})
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    if (!form.property_address || !form.buyer_name) return
    setSaving(true)
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = (await res.json()) as any
    if (data.id) {
      setReservations(prev => [{
        ...form, id: data.id, stage: 'reservada',
        created_at: new Date().toISOString(),
      }, ...prev])
      setForm({ property_address: '', buyer_name: '', seller_name: '', agent_id: '', offer_amount: '', offer_currency: 'USD', reservation_date: '', notes: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function handleAdvance(reservation: any) {
    const next = getNextStage(reservation.stage)
    if (!next) return
    const res = await fetch('/api/reservations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reservation, stage: next }),
    })
    const data = (await res.json()) as any
    if (data.success) {
      setReservations(prev => prev.map(r => r.id === reservation.id ? { ...r, stage: next } : r))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta reserva?')) return
    await fetch(`/api/reservations?id=${id}`, { method: 'DELETE' })
    setReservations(prev => prev.filter(r => r.id !== id))
  }

  function ReservationCard({ r, compact }: { r: any; compact?: boolean }) {
    const stageInfo = getStageInfo(r.stage)
    const next = getNextStage(r.stage)
    return (
      <div className={`bg-white rounded-xl shadow-sm p-4 ${compact ? '' : 'mb-3'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <h3 className="font-semibold text-gray-800 text-sm truncate">{r.property_address || 'Sin direccion'}</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className="w-3 h-3" />
              <span className="truncate">{r.buyer_name || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stageInfo.color}`}>
              {stageInfo.label}
            </span>
            <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-500 p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {r.offer_amount && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {r.offer_currency || 'USD'} {Number(r.offer_amount).toLocaleString('es-AR')}
              </span>
            )}
            {r.reservation_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {r.reservation_date}
              </span>
            )}
            {r.agent_name && (
              <span className="hidden sm:inline truncate">{r.agent_name}</span>
            )}
          </div>
          {next && (
            <button
              onClick={() => handleAdvance(r)}
              className="flex items-center gap-1 text-[10px] font-medium text-[#ff007c] hover:text-[#ff8017] transition-colors"
              title={`Avanzar a ${getStageInfo(next).label}`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{getStageInfo(next).label}</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Handshake className="w-6 h-6 text-[#ff007c]" /> Reservas
          </h1>
          <p className="text-sm text-brand-gray mt-1">Seguimiento de operaciones en curso</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
            >
              Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}
            >
              Kanban
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
      </div>

      {/* New reservation modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Nueva reserva</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Direccion de la propiedad *</label>
                <input type="text" value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" placeholder="Ej: Av. Libertador 1234" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Comprador *</label>
                  <input type="text" value={form.buyer_name} onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vendedor</label>
                  <input type="text" value={form.seller_name} onChange={e => setForm(f => ({ ...f, seller_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
              </div>
              {agents.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Agente</label>
                  <select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">-- Seleccionar --</option>
                    {agents.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monto oferta</label>
                  <input type="number" value={form.offer_amount} onChange={e => setForm(f => ({ ...f, offer_amount: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Moneda</label>
                  <select value={form.offer_currency} onChange={e => setForm(f => ({ ...f, offer_currency: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Fecha reserva</label>
                <input type="date" value={form.reservation_date} onChange={e => setForm(f => ({ ...f, reservation_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50" />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.property_address || !form.buyer_name} className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Handshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-brand-gray">No hay reservas registradas</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-[#ff007c] font-medium hover:underline">
            Crear primera reserva
          </button>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2">
          {reservations.map((r: any) => (
            <ReservationCard key={r.id} r={r} />
          ))}
        </div>
      ) : (
        /* Kanban view */
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-4 lg:grid-cols-8">
            {STAGES.map(stage => {
              const stageItems = reservations.filter((r: any) => r.stage === stage.key)
              return (
                <div key={stage.key} className="w-64 sm:w-auto flex-shrink-0 sm:flex-shrink">
                  <div className={`rounded-lg px-3 py-1.5 mb-2 ${stage.color}`}>
                    <h3 className="text-xs font-semibold">{stage.label}</h3>
                    <span className="text-[10px] opacity-75">{stageItems.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageItems.map((r: any) => (
                      <ReservationCard key={r.id} r={r} compact />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
