'use client'
import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Target, Trash2, ChevronLeft, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  OBJECTIVE_METRICS, PERIOD_TYPES, getObjectiveSemaforo, getPeriodProgressPct,
  type ObjectiveMetric
} from '@/lib/crm-config'

export default function ObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    agent_id: '', period_type: 'monthly', metric: 'llamadas', target: ''
  })

  function getPeriodDates(periodType: string) {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    switch (periodType) {
      case 'weekly': {
        const s = new Date(now); s.setDate(now.getDate() - now.getDay())
        const e = new Date(s); e.setDate(s.getDate() + 6)
        return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }
      }
      case 'monthly':
        return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}` }
      case 'quarterly': {
        const q = Math.floor(m/3)
        return { start: `${y}-${String(q*3+1).padStart(2,'0')}-01`, end: `${y}-${String(q*3+3).padStart(2,'0')}-${new Date(y,q*3+3,0).getDate()}` }
      }
      case 'yearly': return { start: `${y}-01-01`, end: `${y}-12-31` }
      default: return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}` }
    }
  }

  const loadData = () => {
    Promise.all([
      fetch('/api/objectives').then(r => r.json() as Promise<any>),
      fetch('/api/agents').then(r => r.json() as Promise<any>),
      fetch('/api/activities?start=' + new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]).then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([objs, agts, acts]) => {
      setObjectives(Array.isArray(objs) ? objs : [])
      setAgents(Array.isArray(agts) ? agts : [])
      setActivities(Array.isArray(acts) ? acts : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  // Enrich objectives with realized count + semáforo
  const enriched = useMemo(() => {
    return objectives.map((obj: any) => {
      const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
      const types = (metricCfg?.activityTypes || []) as readonly string[]
      // Filter activities within the objective's period and agent
      const periodActs = activities.filter((a: any) =>
        a.agent_id === obj.agent_id &&
        (a.completed_at || a.created_at) >= obj.period_start &&
        (a.completed_at || a.created_at) <= obj.period_end + 'T23:59:59' &&
        (types.length === 0 || types.includes(a.activity_type))
      )
      const realized = types.length > 0 ? periodActs.length : 0
      const periodPct = getPeriodProgressPct(obj.period_start, obj.period_end)
      const semaforo = getObjectiveSemaforo(realized, obj.target, periodPct)
      const remaining = Math.max(obj.target - realized, 0)
      const pct = obj.target > 0 ? Math.round((realized / obj.target) * 100) : 0
      return { ...obj, realized, pct, remaining, periodPct, semaforo, metricLabel: metricCfg?.label || obj.metric }
    })
  }, [objectives, activities])

  // Summary stats
  const summary = useMemo(() => {
    const total = enriched.length
    const cumplidos = enriched.filter(o => o.pct >= 100).length
    const atrasados = enriched.filter(o => o.semaforo.level === 'red' || o.semaforo.level === 'orange').length
    const avgPct = total > 0 ? Math.round(enriched.reduce((s: number, o: any) => s + o.pct, 0) / total) : 0
    return { total, cumplidos, atrasados, avgPct }
  }, [enriched])

  const handleCreate = async () => {
    if (!form.agent_id || !form.target) return
    setSaving(true)
    const { start, end } = getPeriodDates(form.period_type)
    try {
      await fetch('/api/objectives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: form.agent_id, period_type: form.period_type, period_start: start, period_end: end, metric: form.metric, target: parseInt(form.target) || 0 }),
      })
      setShowCreate(false)
      setForm({ agent_id: '', period_type: 'monthly', metric: 'llamadas', target: '' })
      toast('Objetivo creado')
      loadData()
    } catch { toast('Error al crear objetivo', 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo?')) return
    await fetch(`/api/objectives?id=${id}`, { method: 'DELETE' })
    toast('Objetivo eliminado', 'warning')
    loadData()
  }

  // Group by agent
  const grouped = agents.map(agent => ({
    ...agent,
    objectives: enriched.filter((o: any) => o.agent_id === agent.id),
  })).filter(a => a.objectives.length > 0)

  // Metric categories
  const metricCategories = [
    { key: 'actividad', label: 'Actividad' },
    { key: 'resultado', label: 'Resultados' },
  ]

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link href="/configuracion" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-1">
            <ChevronLeft className="w-3 h-3" /> Configuración
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-pink-500" /> Objetivos por agente
          </h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-pink-700">
          <Plus className="w-4 h-4" /> Nuevo objetivo
        </button>
      </div>

      {/* Summary cards */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
            <p className="text-xs text-gray-500">Activos</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.cumplidos}</p>
            <p className="text-xs text-gray-500">Cumplidos</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.atrasados}</p>
            <p className="text-xs text-gray-500">Atrasados</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{summary.avgPct}%</p>
            <p className="text-xs text-gray-500">Avance promedio</p>
          </div>
        </div>
      )}

      {/* Objectives by agent */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : enriched.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">Sin objetivos definidos</p>
          <p className="text-sm text-gray-400 mt-1">Creá objetivos para medir la performance de tu equipo</p>
          <button onClick={() => setShowCreate(true)} className="mt-4 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Crear primer objetivo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(agent => (
            <div key={agent.id} className="bg-white rounded-xl border p-4 sm:p-5">
              <h3 className="font-semibold text-gray-800 mb-3">{agent.full_name}</h3>
              <div className="space-y-3">
                {agent.objectives.map((obj: any) => {
                  const periodCfg = PERIOD_TYPES[obj.period_type as keyof typeof PERIOD_TYPES]
                  return (
                    <div key={obj.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">{obj.metricLabel}</span>
                          <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{periodCfg?.label || obj.period_type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                        </div>
                        <button onClick={() => handleDelete(obj.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-800">{obj.realized}</p>
                          <p className="text-[10px] text-gray-400">Realizado</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-400">{obj.target}</p>
                          <p className="text-[10px] text-gray-400">Objetivo</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-lg font-bold ${obj.pct >= 100 ? 'text-green-600' : obj.pct >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{obj.pct}%</p>
                          <p className="text-[10px] text-gray-400">Avance</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-500">{obj.remaining}</p>
                          <p className="text-[10px] text-gray-400">Faltan</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${obj.pct >= 100 ? 'bg-green-500' : obj.pct >= 60 ? 'bg-yellow-500' : obj.pct >= 30 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                        {/* Period progress indicator */}
                        <div className="absolute top-0 h-full w-0.5 bg-gray-400" style={{ left: `${obj.periodPct}%` }} title={`${obj.periodPct}% del período`} />
                      </div>
                      <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                        <span>{obj.period_start}</span>
                        <span>{obj.periodPct}% del período</span>
                        <span>{obj.period_end}</span>
                      </div>
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Métrica</label>
                {metricCategories.map(cat => (
                  <div key={cat.key} className="mb-2">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">{cat.label}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {Object.entries(OBJECTIVE_METRICS).filter(([, v]) => v.category === cat.key).map(([k, v]) => (
                        <button key={k} onClick={() => setForm({ ...form, metric: k })}
                          className={`px-2 py-1.5 rounded-lg text-xs border transition-all ${form.metric === k ? 'border-pink-500 bg-pink-50 text-pink-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Período</label>
                  <select value={form.period_type} onChange={e => setForm({ ...form, period_type: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(PERIOD_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Target</label>
                  <input type="number" placeholder="Ej: 15" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.agent_id || !form.target || saving} className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
