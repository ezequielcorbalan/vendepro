'use client'
import { useState, useEffect, useMemo } from 'react'
import { Target, Plus, Trash2, Users, Loader2, CheckCircle2, AlertTriangle, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { OBJECTIVE_METRICS, getObjectiveSemaforo, getPeriodProgressPct } from '@/lib/crm-config'

const METRIC_KEYS = Object.keys(OBJECTIVE_METRICS) as (keyof typeof OBJECTIVE_METRICS)[]

const PERIOD_PRESETS = [
  { label: 'Este mes', type: 'monthly', start: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }, end: () => { const d = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0); return d.toISOString().split('T')[0] } },
  { label: 'Este trimestre', type: 'quarterly', start: () => { const d = new Date(); const q = Math.floor(d.getMonth()/3)*3; return `${d.getFullYear()}-${String(q+1).padStart(2,'0')}-01` }, end: () => { const d = new Date(); const q = Math.floor(d.getMonth()/3)*3+3; return new Date(d.getFullYear(), q, 0).toISOString().split('T')[0] } },
  { label: 'Este año', type: 'yearly', start: () => `${new Date().getFullYear()}-01-01`, end: () => `${new Date().getFullYear()}-12-31` },
]

export default function ObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Batch creation state
  const [showBatch, setShowBatch] = useState(false)
  const [batchPeriod, setBatchPeriod] = useState(0) // index into PERIOD_PRESETS
  const [batchMetrics, setBatchMetrics] = useState<string[]>(['llamadas', 'reuniones', 'tasaciones', 'captaciones'])
  const [batchTargets, setBatchTargets] = useState<Record<string, Record<string, number>>>({}) // agentId → metric → target

  useEffect(() => {
    Promise.all([
      fetch('/api/objectives').then(r => r.json() as Promise<any>),
      fetch('/api/agents').then(r => r.json() as Promise<any>),
    ]).then(([objs, ags]) => {
      setObjectives(Array.isArray(objs) ? objs : [])
      setAgents(Array.isArray(ags) ? ags : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Initialize batch targets when agents change
  const initBatchTargets = () => {
    const targets: Record<string, Record<string, number>> = {}
    agents.forEach(a => {
      targets[a.id] = {}
      batchMetrics.forEach(m => { targets[a.id][m] = 0 })
    })
    setBatchTargets(targets)
  }

  const handleBatchSave = async () => {
    const preset = PERIOD_PRESETS[batchPeriod]
    const batch: any[] = []
    for (const agentId of Object.keys(batchTargets)) {
      for (const metric of batchMetrics) {
        const target = batchTargets[agentId]?.[metric]
        if (target && target > 0) {
          batch.push({
            agent_id: agentId,
            metric,
            target,
            period_type: preset.type,
            period_start: preset.start(),
            period_end: preset.end(),
          })
        }
      }
    }
    if (batch.length === 0) { toast('No hay objetivos para guardar', 'warning'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/objectives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch }),
      })
      const data = (await res.json()) as any
      toast(`${data.created || batch.length} objetivos creados`, 'success')
      setShowBatch(false)
      // Reload
      const objs = (await (await fetch('/api/objectives')).json()) as any
      setObjectives(Array.isArray(objs) ? objs : [])
    } catch { toast('Error al guardar', 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/objectives?id=${id}`, { method: 'DELETE' })
      setObjectives(prev => prev.filter(o => o.id !== id))
      toast('Objetivo eliminado')
    } catch { toast('Error', 'error') }
  }

  // Group by agent
  const byAgent = useMemo(() => {
    const map: Record<string, { agent: string; items: any[] }> = {}
    objectives.forEach(o => {
      if (!map[o.agent_id]) map[o.agent_id] = { agent: o.agent_name || 'Sin asignar', items: [] }
      map[o.agent_id].items.push(o)
    })
    return Object.entries(map)
  }, [objectives])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#ff007c] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-[#ff007c]" /> Objetivos por agente
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{objectives.length} objetivos activos · {agents.length} agentes</p>
        </div>
        <button onClick={() => { setShowBatch(true); initBatchTargets() }}
          className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
          <Plus className="w-4 h-4" /> Carga masiva
        </button>
      </div>

      {/* Batch creation modal */}
      {showBatch && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowBatch(false)}>
          <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Carga masiva de objetivos</h2>
              <button onClick={() => setShowBatch(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Period selector */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Período</label>
                <div className="flex gap-2">
                  {PERIOD_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => setBatchPeriod(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${batchPeriod === i ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metric selector */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Métricas a incluir</label>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_KEYS.map(key => (
                    <button key={key} onClick={() => {
                      setBatchMetrics(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
                    }} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                      batchMetrics.includes(key) ? 'bg-[#ff007c]/10 text-[#ff007c] border border-[#ff007c]/30' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {OBJECTIVE_METRICS[key].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table: agents x metrics */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-500 w-40">Agente</th>
                      {batchMetrics.map(m => (
                        <th key={m} className="text-center py-2 px-1 font-medium text-gray-500 min-w-[70px]">
                          {OBJECTIVE_METRICS[m as keyof typeof OBJECTIVE_METRICS]?.label || m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(agent => (
                      <tr key={agent.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium text-gray-700">{agent.full_name}</td>
                        {batchMetrics.map(metric => (
                          <td key={metric} className="py-1 px-1 text-center">
                            <input
                              type="number" min="0"
                              value={batchTargets[agent.id]?.[metric] || ''}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0
                                setBatchTargets(prev => ({
                                  ...prev,
                                  [agent.id]: { ...(prev[agent.id] || {}), [metric]: val }
                                }))
                              }}
                              className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c]"
                              placeholder="0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save */}
              <button onClick={handleBatchSave} disabled={saving}
                className="w-full bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar {Object.values(batchTargets).reduce((s, m) => s + Object.values(m).filter(v => v > 0).length, 0)} objetivos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current objectives grouped by agent */}
      {byAgent.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Target className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay objetivos activos</p>
          <p className="text-xs text-gray-400 mt-1">Us&aacute; &quot;Carga masiva&quot; para crear objetivos para todo el equipo</p>
        </div>
      ) : (
        <div className="space-y-4">
          {byAgent.map(([agentId, { agent, items }]) => (
            <div key={agentId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-sm text-gray-800">{agent}</span>
                <span className="text-xs text-gray-400">{items.length} objetivos</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((obj: any) => {
                  const cfg = OBJECTIVE_METRICS[obj.metric as keyof typeof OBJECTIVE_METRICS]
                  const periodProg = getPeriodProgressPct(obj.period_start, obj.period_end)
                  const semaforo = getObjectiveSemaforo(0, obj.target, periodProg) // 0 realized for now — needs activity data
                  const periodLabel = obj.period_type === 'monthly' ? 'Mensual' : obj.period_type === 'quarterly' ? 'Trimestral' : 'Anual'

                  return (
                    <div key={obj.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{cfg?.label || obj.metric}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{periodLabel}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400">Objetivo: <strong className="text-gray-700">{obj.target}</strong></span>
                          <span className="text-xs text-gray-400">{obj.period_start} → {obj.period_end}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(obj.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
