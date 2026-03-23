'use client'
import { useState, useEffect } from 'react'
import { Plus, X, Target, Trash2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { OBJECTIVE_METRICS, PERIOD_TYPES } from '@/lib/crm-config'

export default function ObjetivosPage() {
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    agent_id: '', period_type: 'monthly', metric: 'llamadas', target: ''
  })

  // Calculate period_start and period_end based on period_type
  function getPeriodDates(periodType: string) {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    switch (periodType) {
      case 'weekly': {
        const start = new Date(now)
        start.setDate(now.getDate() - now.getDay())
        const end = new Date(start)
        end.setDate(start.getDate() + 6)
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
      }
      case 'monthly':
        return {
          start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
          end: `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
        }
      case 'quarterly': {
        const q = Math.floor(m / 3)
        return {
          start: `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`,
          end: `${y}-${String(q * 3 + 3).padStart(2, '0')}-${new Date(y, q * 3 + 3, 0).getDate()}`
        }
      }
      case 'yearly':
        return { start: `${y}-01-01`, end: `${y}-12-31` }
      default:
        return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}` }
    }
  }

  const loadData = () => {
    Promise.all([
      fetch('/api/objectives').then(r => r.json() as Promise<any>),
      fetch('/api/agents').then(r => r.json() as Promise<any>),
    ]).then(([objs, agts]) => {
      setObjectives(Array.isArray(objs) ? objs : [])
      setAgents(Array.isArray(agts) ? agts : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleCreate = async () => {
    if (!form.agent_id || !form.target) return
    setSaving(true)
    const { start, end } = getPeriodDates(form.period_type)
    try {
      await fetch('/api/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: form.agent_id,
          period_type: form.period_type,
          period_start: start,
          period_end: end,
          metric: form.metric,
          target: parseInt(form.target) || 0,
        }),
      })
      setShowCreate(false)
      setForm({ agent_id: '', period_type: 'monthly', metric: 'llamadas', target: '' })
      loadData()
    } catch {}
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo?')) return
    await fetch(`/api/objectives?id=${id}`, { method: 'DELETE' })
    loadData()
  }

  // Group objectives by agent
  const grouped = agents.map(agent => ({
    ...agent,
    objectives: objectives.filter((o: any) => o.agent_id === agent.id),
  })).filter(a => a.objectives.length > 0)

  const unassigned = objectives.filter((o: any) => !agents.find((a: any) => a.id === o.agent_id))

  return (
    <div className="space-y-4 sm:space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/configuracion" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-1">
            <ChevronLeft className="w-3 h-3" /> Configuración
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-pink-500" /> Objetivos por agente
          </h1>
          <p className="text-gray-500 text-sm">{objectives.length} objetivo{objectives.length !== 1 ? 's' : ''} activo{objectives.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-pink-700">
          <Plus className="w-4 h-4" /> Nuevo objetivo
        </button>
      </div>

      {/* Objectives list grouped by agent */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : objectives.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Sin objetivos definidos</p>
          <p className="text-sm text-gray-400 mt-1">Creá objetivos para medir la performance de tu equipo</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700">
            Crear primer objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(agent => (
            <div key={agent.id} className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-800 mb-3">{agent.full_name}</h3>
              <div className="space-y-2">
                {agent.objectives.map((obj: any) => {
                  const metricCfg = OBJECTIVE_METRICS[obj.metric as keyof typeof OBJECTIVE_METRICS]
                  const periodCfg = PERIOD_TYPES[obj.period_type as keyof typeof PERIOD_TYPES]
                  return (
                    <div key={obj.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{metricCfg?.label || obj.metric}</span>
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{periodCfg?.label || obj.period_type}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Target: <strong className="text-gray-700">{obj.target}</strong> · {obj.period_start} → {obj.period_end}
                        </p>
                      </div>
                      <button onClick={() => handleDelete(obj.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-gray-800">Nuevo objetivo</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Agente</label>
                <select value={form.agent_id} onChange={e => setForm({ ...form, agent_id: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Seleccionar agente...</option>
                  {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Métrica</label>
                  <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(OBJECTIVE_METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Período</label>
                  <select value={form.period_type} onChange={e => setForm({ ...form, period_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(PERIOD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Target (cantidad)</label>
                <input type="number" placeholder="Ej: 15" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="px-4 py-3 border-t flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.agent_id || !form.target || saving} className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
