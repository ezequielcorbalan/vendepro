'use client'

import { useState, useEffect } from 'react'
import { Target, Plus, Trash2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  OBJECTIVE_METRICS, getObjectiveSemaforo, getPeriodProgressPct,
  type ObjectiveMetric
} from '@/lib/crm-config'

export default function ObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAgent, setFilterAgent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    agent_id: '',
    metric: 'llamadas' as ObjectiveMetric,
    target: '',
    period_type: 'monthly',
    period_start: new Date().toISOString().split('T')[0],
    period_end: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })(),
  })

  function loadData() {
    const params = filterAgent ? `?agent_id=${filterAgent}` : ''
    Promise.all([
      apiFetch('admin', `/objectives${params}`).then(r => r.json() as Promise<any>),
      apiFetch('admin', '/agents').then(r => r.json() as Promise<any>),
    ]).then(([objs, agts]) => {
      setObjectives(Array.isArray(objs) ? objs : [])
      setAgents(Array.isArray(agts) ? agts : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [filterAgent])

  async function handleCreate() {
    if (!form.agent_id || !form.target) return
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        body: JSON.stringify({ ...form, target: Number(form.target) }),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        toast('Objetivo creado')
        setShowCreate(false)
        loadData()
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return
    await apiFetch('admin', `/objectives?id=${id}`, { method: 'DELETE' })
    toast('Objetivo eliminado', 'warning')
    loadData()
  }

  const objectivesWithProgress = objectives.map(obj => {
    const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
    const periodPct = getPeriodProgressPct(obj.period_start, obj.period_end)
    const semaforo = getObjectiveSemaforo(obj.realized || 0, obj.target, periodPct)
    return { ...obj, semaforo, metricLabel: metricCfg?.label || obj.metric }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Objetivos</h1>
          <p className="text-gray-500 text-sm">{objectives.length} objetivo{objectives.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo objetivo
        </button>
      </div>

      {agents.length > 0 && (
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : objectives.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin objetivos definidos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {objectivesWithProgress.map(obj => (
            <div key={obj.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-800">{obj.metricLabel}</p>
                  {obj.agent_name && <p className="text-xs text-gray-400 mt-0.5">{obj.agent_name}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                  <button onClick={() => handleDelete(obj.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-3xl font-bold text-gray-800">{obj.realized || 0}</p>
                <p className="text-sm text-gray-400">/{obj.target}</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full transition-all"
                  style={{ width: `${Math.min(Math.round(((obj.realized || 0) / obj.target) * 100), 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>{new Date(obj.period_start).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                <span>{new Date(obj.period_end).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">Nuevo objetivo</h3>
            <div className="space-y-3">
              <select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="">Seleccionar agente *</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as ObjectiveMetric }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                {Object.entries(OBJECTIVE_METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input type="number" placeholder="Target (número) *" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Inicio</label>
                  <input type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                  <input type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                    className="border rounded-lg px-3 py-2 text-sm w-full" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.agent_id || !form.target || saving}
                className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
