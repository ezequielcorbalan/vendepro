'use client'
import { useState, useEffect, useMemo } from 'react'
import { Target, Plus, Trash2, Save, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { OBJECTIVE_METRICS, type ObjectiveMetric, getObjectiveSemaforo, getPeriodProgressPct } from '@/lib/crm-config'

const METRIC_KEYS = Object.keys(OBJECTIVE_METRICS) as ObjectiveMetric[]
const CATEGORIES = {
  actividad: { label: 'Actividad / Prospección', metrics: METRIC_KEYS.filter(k => OBJECTIVE_METRICS[k].category === 'actividad') },
  resultado: { label: 'Resultados', metrics: METRIC_KEYS.filter(k => OBJECTIVE_METRICS[k].category === 'resultado') },
}

const PERIOD_PRESETS = {
  weekly: { label: 'Semanal', getRange: () => { const d = new Date(); const s = new Date(d); s.setDate(d.getDate() - d.getDay() + 1); const e = new Date(s); e.setDate(s.getDate() + 6); return { start: fmt(s), end: fmt(e) } } },
  monthly: { label: 'Mensual', getRange: () => { const d = new Date(); return { start: `${d.getFullYear()}-${p(d.getMonth()+1)}-01`, end: `${d.getFullYear()}-${p(d.getMonth()+1)}-${new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()}` } } },
  quarterly: { label: 'Trimestral', getRange: () => { const d = new Date(); const qm = Math.floor(d.getMonth() / 3) * 3; return { start: `${d.getFullYear()}-${p(qm+1)}-01`, end: `${d.getFullYear()}-${p(qm+3)}-${new Date(d.getFullYear(), qm+3, 0).getDate()}` } } },
  yearly: { label: 'Anual', getRange: () => { const y = new Date().getFullYear(); return { start: `${y}-01-01`, end: `${y}-12-31` } } },
}
function p(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }

type Agent = { id: string; full_name: string }
type Objective = { id: string; agent_id: string; agent_name: string; metric: string; target: number; period_type: string; period_start: string; period_end: string }

export default function ObjetivosPage() {
  const { toast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)

  // Batch creation
  const [showBatch, setShowBatch] = useState(false)
  const [batchAgents, setBatchAgents] = useState<string[]>([])
  const [batchPeriod, setBatchPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [batchTargets, setBatchTargets] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then(r => r.json() as Promise<any>),
      fetch('/api/objectives').then(r => r.json() as Promise<any>),
    ]).then(([a, o]) => {
      if (Array.isArray(a)) setAgents(a)
      if (Array.isArray(o)) setObjectives(o)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const periodRange = PERIOD_PRESETS[batchPeriod].getRange()

  const byAgent = useMemo(() => {
    const map: Record<string, Objective[]> = {}
    for (const o of objectives) {
      if (!map[o.agent_id]) map[o.agent_id] = []
      map[o.agent_id].push(o)
    }
    return map
  }, [objectives])

  async function saveBatch() {
    if (batchAgents.length === 0) { toast('Seleccioná al menos un agente', 'warning'); return }
    const items = batchAgents.flatMap(agentId =>
      Object.entries(batchTargets)
        .filter(([, target]) => target > 0)
        .map(([metric, target]) => ({
          agent_id: agentId, metric, target,
          period_type: batchPeriod,
          period_start: periodRange.start,
          period_end: periodRange.end,
        }))
    )
    if (items.length === 0) { toast('Cargá al menos un objetivo con valor > 0', 'warning'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/objectives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: items }),
      })
      const data = (await res.json()) as any
      if (data.created) {
        toast(`${data.created} objetivos creados para ${batchAgents.length} agente${batchAgents.length > 1 ? 's' : ''}`)
        const fresh = await fetch('/api/objectives').then(r => r.json() as Promise<any>)
        if (Array.isArray(fresh)) setObjectives(fresh)
        setShowBatch(false)
        setBatchTargets({})
        setBatchAgents([])
      } else {
        toast(data.error || 'Error', 'error')
      }
    } catch { toast('Error al guardar', 'error') }
    finally { setSaving(false) }
  }

  async function deleteObj(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return
    await fetch(`/api/objectives?id=${id}`, { method: 'DELETE' })
    setObjectives(prev => prev.filter(o => o.id !== id))
    toast('Objetivo eliminado')
  }

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="bg-gray-100 rounded-xl h-20" />)}</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-[#ff007c]" /> Objetivos por agente
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{objectives.length} objetivos activos</p>
        </div>
        <button onClick={() => setShowBatch(!showBatch)}
          className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Crear en batch
        </button>
      </div>

      {showBatch && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Crear objetivos en batch</h2>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Período</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
              {(Object.entries(PERIOD_PRESETS) as [string, any][]).map(([k, v]) => (
                <button key={k} onClick={() => setBatchPeriod(k as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${batchPeriod === k ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                  {v.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{periodRange.start} → {periodRange.end}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Agentes</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBatchAgents(batchAgents.length === agents.length ? [] : agents.map(a => a.id))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  batchAgents.length === agents.length ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200'
                }`}>
                Todos
              </button>
              {agents.map(a => (
                <button key={a.id}
                  onClick={() => setBatchAgents(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    batchAgents.includes(a.id) ? 'bg-[#ff007c] text-white border-[#ff007c]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}>
                  {a.full_name}
                </button>
              ))}
            </div>
          </div>

          {Object.entries(CATEGORIES).map(([catKey, cat]) => (
            <div key={catKey}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {cat.metrics.map(metric => (
                  <div key={metric} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <label className="text-xs text-gray-600 flex-1 truncate">{OBJECTIVE_METRICS[metric].label}</label>
                    <input type="number" min="0" step="1"
                      value={batchTargets[metric] || ''}
                      onChange={e => setBatchTargets(prev => ({ ...prev, [metric]: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-16 text-right border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c]" />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {batchAgents.length > 0 && Object.values(batchTargets).some(v => v > 0) && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-xs text-pink-700">
              Se crearán <strong>{batchAgents.length * Object.values(batchTargets).filter(v => v > 0).length}</strong> objetivos
              ({Object.values(batchTargets).filter(v => v > 0).length} métricas × {batchAgents.length} agente{batchAgents.length > 1 ? 's' : ''})
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={saveBatch} disabled={saving}
              className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar objetivos'}
            </button>
            <button onClick={() => setShowBatch(false)} className="text-gray-500 text-sm hover:text-gray-700 px-3">Cancelar</button>
          </div>
        </div>
      )}

      {agents.map(agent => {
        const agentObjs = byAgent[agent.id]
        if (!agentObjs || agentObjs.length === 0) return null
        return <AgentCard key={agent.id} agent={agent} objectives={agentObjs} onDelete={deleteObj} />
      })}

      {objectives.length === 0 && !showBatch && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin objetivos cargados</p>
          <p className="text-sm text-gray-400 mt-1">Usá &quot;Crear en batch&quot; para cargar objetivos para tus agentes</p>
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent, objectives, onDelete }: { agent: { id: string; full_name: string }; objectives: Objective[]; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-800">{agent.full_name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{objectives.length}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {objectives.map(obj => {
            const cfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
            return (
              <div key={obj.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                <span className="text-sm text-gray-700 flex-1 truncate">{cfg?.label || obj.metric}</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{obj.period_type}</span>
                <span className="text-sm font-bold text-gray-800 w-12 text-right">{obj.target}</span>
                <span className="text-[10px] text-gray-400 w-20 text-right hidden sm:block">{obj.period_start?.slice(5)}</span>
                <button onClick={() => onDelete(obj.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
