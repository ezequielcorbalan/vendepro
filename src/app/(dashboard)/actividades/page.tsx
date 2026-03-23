'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock,
  FileText, Settings, CheckCircle2, Target, Plus, X,
  BarChart3
} from 'lucide-react'
import {
  ACTIVITY_TYPES, ACTIVITY_TYPE_KEYS, OBJECTIVE_METRICS,
  getObjectiveSemaforo, getPeriodProgressPct, type ActivityType, type ObjectiveMetric
} from '@/lib/crm-config'

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
      fetch(`/api/activities?${params}`).then(r => r.json() as Promise<any>),
      fetch('/api/objectives' + (filterAgent ? `?agent_id=${filterAgent}` : '')).then(r => r.json() as Promise<any>).catch(() => []),
      fetch('/api/agents').then(r => r.json() as Promise<any>).catch(() => []),
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

  const totalActivities = activities.length

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

  const dailyData = useMemo(() => {
    // Adapt chart to period: week=7 days, month=weeks, quarter/year=months
    if (period === 'week' || period === 'month') {
      // Daily view
      const numDays = period === 'week' ? 7 : 30
      const days: Record<string, number> = {}
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        days[d.toISOString().split('T')[0]] = 0
      }
      activities.forEach(a => {
        const day = (a.completed_at || a.created_at || '').split('T')[0]
        if (days[day] !== undefined) days[day]++
      })
      return Object.entries(days).map(([day, count]) => ({ day, count }))
    } else {
      // Monthly view for quarter/year
      const months: Record<string, number> = {}
      const numMonths = period === 'quarter' ? 3 : 12
      for (let i = numMonths - 1; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months[key] = 0
      }
      activities.forEach(a => {
        const date = a.completed_at || a.created_at || ''
        const key = date.substring(0, 7)
        if (months[key] !== undefined) months[key]++
      })
      return Object.entries(months).map(([day, count]) => ({ day, count }))
    }
  }, [activities, period])

  // Agent ranking
  const agentRanking = useMemo(() => {
    const agents: Record<string, { name: string; count: number; llamadas: number; reuniones: number; visitas: number }> = {}
    activities.forEach(a => {
      const name = a.agent_name || 'Sin agente'
      if (!agents[name]) agents[name] = { name, count: 0, llamadas: 0, reuniones: 0, visitas: 0 }
      agents[name].count++
      if (a.activity_type === 'llamada') agents[name].llamadas++
      if (a.activity_type === 'reunion') agents[name].reuniones++
      if (['visita_captacion', 'visita_comprador'].includes(a.activity_type)) agents[name].visitas++
    })
    const sorted = Object.values(agents).sort((a, b) => b.count - a.count)
    const max = sorted[0]?.count || 1
    return sorted.map(a => ({ ...a, pct: Math.round((a.count / max) * 100) }))
  }, [activities])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await fetch('/api/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_type: form.activity_type, description: form.description, lead_id: form.lead_id || null, completed_at: new Date().toISOString() }),
      })
      setShowCreate(false)
      setForm({ activity_type: 'llamada', description: '', lead_id: '' })
      loadData()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Actividad Comercial</h1>
          <p className="text-gray-500 text-sm">{totalActivities} actividades en el período</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agents.length > 1 && (
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos los agentes</option>
              {agents.map((a: any) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            {PERIOD_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={() => setShowCreate(true)} className="bg-pink-600 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-pink-700">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Registrar</span><span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        {(['llamada', 'reunion', 'visita_captacion', 'tasacion', 'seguimiento', 'whatsapp'] as ActivityType[]).map(key => {
          const cfg = ACTIVITY_TYPES[key]
          const IconComp = ICON_MAP[cfg.icon] || Clock
          return (
            <button key={key} onClick={() => setFilterType(filterType === key ? '' : key)}
              className={`bg-white border rounded-xl p-3 text-center transition-all hover:shadow-sm ${filterType === key ? 'ring-2 ring-pink-500 border-pink-300' : ''}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${cfg.color}`}>
                <IconComp className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-800">{metrics[key] || 0}</p>
              <p className="text-[10px] text-gray-500 truncate">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Objectives */}
      {objectivesWithProgress.length > 0 && (
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-500" /> Objetivos del período
          </h2>
          <div className="space-y-3">
            {objectivesWithProgress.map((obj: any) => (
              <div key={obj.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{obj.metricLabel}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{obj.realized}/{obj.target} <span className="text-xs text-gray-400">({obj.pct}%)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${obj.semaforo.level === 'green' ? 'bg-green-500' : obj.semaforo.level === 'yellow' ? 'bg-yellow-500' : obj.semaforo.level === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily chart + Activity list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-pink-500" /> {period === 'week' ? 'Esta semana' : period === 'month' ? 'Últimos 30 días' : 'Evolución'}
          </h3>
          <div className="flex items-end gap-1 h-24">
            {dailyData.slice(period === 'month' ? -14 : undefined).map(d => {
              const sliced = dailyData.slice(period === 'month' ? -14 : undefined)
              const max = Math.max(...sliced.map(x => x.count), 1)
              const h = Math.max((d.count / max) * 100, 4)
              const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
              let label = ''
              if (period === 'quarter' || period === 'year') {
                // d.day is "YYYY-MM"
                const m = parseInt(d.day.split('-')[1]) - 1
                label = monthNames[m] || d.day
              } else {
                const dt = new Date(d.day + 'T12:00:00')
                label = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'][dt.getDay()] || ''
                if (period === 'month') label = String(dt.getDate())
              }
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                  <span className="text-[10px] text-gray-500">{d.count || ''}</span>
                  <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '60px' }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-pink-500 rounded-t" style={{ height: `${h}%` }} />
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-gray-400 truncate">{label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{totalActivities}</p>
            <p className="text-xs text-gray-500">Total del período</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Actividad reciente</h3>
            {filterType && (
              <button onClick={() => setFilterType('')} className="text-xs text-pink-600 flex items-center gap-1">
                <X className="w-3 h-3" /> {ACTIVITY_TYPES[filterType as ActivityType]?.label}
              </button>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Sin actividades en este período</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {activities.map((act: any) => {
                const cfg = ACTIVITY_TYPES[act.activity_type as ActivityType]
                const IconComp = cfg ? (ICON_MAP[cfg.icon] || Clock) : Clock
                const time = act.completed_at || act.created_at
                return (
                  <div key={act.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg?.color || 'bg-gray-50 text-gray-500'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800">{cfg?.label || act.activity_type}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {time ? new Date(time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      {act.description && <p className="text-xs text-gray-500 truncate">{act.description}</p>}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                        {act.agent_name && <span>{act.agent_name}</span>}
                        {act.lead_name && <Link href={`/leads/${act.lead_id}`} className="text-pink-500 hover:underline">{act.lead_name}</Link>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Agent ranking */}
      {agentRanking.length > 1 && (
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /> Ranking de agentes
          </h2>
          <div className="space-y-3">
            {agentRanking.map((agent: any, idx: number) => (
              <div key={agent.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800 truncate">{agent.name}</span>
                    <span className="text-sm font-bold text-gray-700">{agent.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full transition-all" style={{ width: `${agent.pct}%` }} />
                  </div>
                </div>
                <div className="hidden sm:flex gap-2 text-[10px] text-gray-400 shrink-0">
                  <span>📞{agent.llamadas}</span>
                  <span>🤝{agent.reuniones}</span>
                  <span>🏠{agent.visitas}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="font-semibold text-gray-800">Registrar actividad</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ACTIVITY_TYPE_KEYS.map(key => {
                    const cfg = ACTIVITY_TYPES[key]
                    const IconComp = ICON_MAP[cfg.icon] || Clock
                    return (
                      <button key={key} onClick={() => setForm({ ...form, activity_type: key })}
                        className={`p-2 rounded-lg border text-center text-xs transition-all ${form.activity_type === key ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <IconComp className="w-4 h-4 mx-auto mb-1" />
                        <span className="truncate block">{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <textarea placeholder="Descripción..." rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.description} className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
