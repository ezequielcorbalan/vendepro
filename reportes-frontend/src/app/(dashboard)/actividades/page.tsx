'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock,
  FileText, Settings, CheckCircle2, Target, Plus, X, BarChart3
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import {
  ACTIVITY_TYPES, ACTIVITY_TYPE_KEYS, OBJECTIVE_METRICS,
  getObjectiveSemaforo, getPeriodProgressPct, type ActivityType, type ObjectiveMetric
} from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

const ICON_MAP: Record<string, any> = {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock,
  FileText, Settings, CheckCircle2, Presentation: Target,
}

const PERIOD_OPTIONS = [
  { key: 'week', label: 'Esta semana', start: () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0] } },
  { key: 'month', label: 'Este mes', start: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` } },
  { key: 'quarter', label: 'Trimestre', start: () => { const d = new Date(); const q = Math.floor(d.getMonth() / 3) * 3; return `${d.getFullYear()}-${String(q + 1).padStart(2, '0')}-01` } },
  { key: 'year', label: 'Este año', start: () => `${new Date().getFullYear()}-01-01` },
]

export default function ActividadesPage() {
  const { toast } = useToast()
  const [activities, setActivities] = useState<any[]>([])
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [filterType, setFilterType] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ activity_type: 'llamada', description: '', lead_id: '' })

  const periodStart = PERIOD_OPTIONS.find(p => p.key === period)?.start() || ''

  const loadData = () => {
    const params = new URLSearchParams()
    if (periodStart) params.set('start', periodStart)
    if (filterType) params.set('type', filterType)
    if (filterAgent) params.set('agent_id', filterAgent)

    Promise.all([
      apiFetch('crm', `/activities?${params}`).then(r => r.json() as Promise<any>),
      apiFetch('admin', '/objectives' + (filterAgent ? `?agent_id=${filterAgent}` : '')).then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([acts, objs, agts]) => {
      setActivities(Array.isArray(acts) ? acts : [])
      setObjectives(Array.isArray(objs) ? objs : [])
      if (Array.isArray(agts)) setAgents(agts)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [period, filterType, filterAgent])

  const metrics = useMemo(() => {
    const counts: Record<string, number> = {}
    ACTIVITY_TYPE_KEYS.forEach(k => { counts[k] = 0 })
    activities.forEach(a => { if (counts[a.activity_type] !== undefined) counts[a.activity_type]++ })
    return counts
  }, [activities])

  const objectivesWithProgress = useMemo(() => {
    return objectives.map((obj: any) => {
      const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
      const types = (metricCfg?.activityTypes || []) as readonly string[]
      const realized = types.length > 0 ? activities.filter(a => types.includes(a.activity_type)).length : 0
      const pct = obj.target > 0 ? Math.round((realized / obj.target) * 100) : 0
      const periodPct = getPeriodProgressPct(obj.period_start, obj.period_end)
      const semaforo = getObjectiveSemaforo(realized, obj.target, periodPct)
      return { ...obj, realized, pct, semaforo, metricLabel: metricCfg?.label || obj.metric }
    })
  }, [objectives, activities])

  const handleCreate = async () => {
    if (!form.description && !form.activity_type) return
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/activities', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id) {
        toast('Actividad registrada')
        setShowCreate(false)
        setForm({ activity_type: 'llamada', description: '', lead_id: '' })
        loadData()
      } else {
        toast(data.error || 'Error al registrar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Actividad</h1>
          <p className="text-gray-500 text-sm">{activities.length} actividades en el período</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {PERIOD_OPTIONS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${period === p.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> Registrar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Todos los tipos</option>
          {ACTIVITY_TYPE_KEYS.map(k => <option key={k} value={k}>{ACTIVITY_TYPES[k].label}</option>)}
        </select>
        {agents.length > 0 && (
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los agentes</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select>
        )}
      </div>

      {/* Objectives */}
      {objectivesWithProgress.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-500" /> Objetivos del período
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {objectivesWithProgress.map(obj => (
              <div key={obj.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{obj.metricLabel}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-800">{obj.realized}<span className="text-sm font-normal text-gray-400">/{obj.target}</span></p>
                <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full transition-all" style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{obj.pct}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity type summary */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-pink-500" /> Por tipo
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {ACTIVITY_TYPE_KEYS.filter(k => metrics[k] > 0 || !filterType).map(k => {
            const cfg = ACTIVITY_TYPES[k]
            const Ico = ICON_MAP[cfg.icon] || Phone
            return (
              <button key={k} onClick={() => setFilterType(filterType === k ? '' : k)}
                className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${filterType === k ? 'border-[#ff007c] bg-pink-50' : 'border-transparent hover:bg-gray-50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color} mb-1`}>
                  <Ico className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-gray-800">{metrics[k]}</p>
                <p className="text-[10px] text-gray-400 text-center leading-tight">{cfg.label}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Activity list */}
      <div className="space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Sin actividades en este período</p>
            <button onClick={() => setShowCreate(true)} className="text-[#ff007c] text-sm mt-2 hover:underline">Registrar primera actividad</button>
          </div>
        ) : activities.map(a => {
          const cfg = ACTIVITY_TYPES[a.activity_type as ActivityType] || ACTIVITY_TYPES.llamada
          const Ico = ICON_MAP[cfg.icon] || Phone
          const mins = Math.floor((Date.now() - new Date(a.completed_at || a.created_at).getTime()) / 60000)
          const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
          return (
            <div key={a.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                <Ico className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{a.description || cfg.label}</p>
                <p className="text-xs text-gray-400 truncate">
                  {a.agent_name && <span>{a.agent_name}</span>}
                  {a.lead_name && <span> · {a.lead_name}</span>}
                </p>
              </div>
              <span className="text-xs text-gray-300 shrink-0">{timeAgo}</span>
            </div>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Registrar actividad</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.activity_type} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                {ACTIVITY_TYPE_KEYS.map(k => <option key={k} value={k}>{ACTIVITY_TYPES[k].label}</option>)}
              </select>
              <textarea placeholder="Descripción..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
