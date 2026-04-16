'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock,
  FileText, Settings, CheckCircle2, Target, Plus, X, Sparkles, BarChart3
} from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
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

const SUMMARY_TYPES: ActivityType[] = ['llamada', 'reunion', 'visita_captacion', 'tasacion', 'seguimiento', 'whatsapp']

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
  const [filterAgent, setFilterAgent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ activity_type: 'llamada', description: '', lead_id: '' })

  const periodStart = PERIOD_OPTIONS.find(p => p.key === period)?.start() || ''

  const loadData = () => {
    const params = new URLSearchParams()
    if (periodStart) params.set('start', periodStart)
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

  useEffect(() => { loadData() }, [period, filterAgent])

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

  const chartData = useMemo(() => {
    const days: { day: number; count: number }[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const count = activities.filter(a => {
        const actDate = (a.completed_at || a.created_at || '').split('T')[0]
        return actDate === dateStr
      }).length
      days.push({ day: d.getDate(), count })
    }
    return days
  }, [activities])

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

  const formatActivityTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Actividad Comercial</h1>
          <p className="text-gray-500 text-sm">{activities.length} actividades en el período</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {agents.length > 0 && (
            <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Todos los agentes</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white">
            {PERIOD_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button className="flex items-center gap-1.5 border border-[#ff007c] text-[#ff007c] px-3 py-2 rounded-lg text-sm font-medium hover:bg-pink-50">
            <Sparkles className="w-4 h-4" /> con IA
          </button>
          <button onClick={() => setShowCreate(true)}
            className="bg-[#ff007c] text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:opacity-90">
            <Plus className="w-4 h-4" /> Registrar
          </button>
        </div>
      </div>

      {/* Activity type summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {SUMMARY_TYPES.map(k => {
          const cfg = ACTIVITY_TYPES[k]
          const Ico = ICON_MAP[cfg.icon] || Phone
          return (
            <div key={k} className="min-w-[120px] border rounded-xl p-4 flex flex-col items-center bg-white shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.color} mb-2`}>
                <Ico className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{metrics[k]}</p>
              <p className="text-xs text-gray-500 text-center mt-0.5">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      {/* Objectives */}
      {objectivesWithProgress.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-500" /> Objetivos del período
          </h2>
          <div className="space-y-4">
            {objectivesWithProgress.map(obj => (
              <div key={obj.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-gray-700 font-medium">{obj.metricLabel}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${obj.semaforo.color}`}>
                      {obj.semaforo.label}
                    </span>
                  </div>
                  <span className="text-sm text-gray-400 shrink-0 ml-4">
                    <span className="font-semibold text-gray-800">{obj.realized}/{obj.target}</span> ({obj.pct}%)
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${obj.semaforo.level === 'green' ? 'bg-green-500' : 'bg-gradient-to-r from-pink-500 to-orange-400'}`}
                    style={{ width: `${Math.min(obj.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimos 30 días chart */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-pink-500" /> Últimos 30 días
          </h2>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={chartData} barSize={7} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <ReferenceLine y={0} stroke="#ff007c" strokeDasharray="3 3" strokeWidth={1.5} />
              <Bar dataKey="count" fill="#e5e7eb" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-center mt-3">
            <p className="text-3xl font-bold text-gray-800">{activities.length}</p>
            <p className="text-xs text-gray-400">Total del período</p>
          </div>
        </div>

        {/* Actividad reciente */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Actividad reciente</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              Sin actividades en este período
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-72">
              {activities.slice(0, 10).map(a => {
                const cfg = ACTIVITY_TYPES[a.activity_type as ActivityType] || ACTIVITY_TYPES.llamada
                const Ico = ICON_MAP[cfg.icon] || Phone
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Ico className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{cfg.label}</p>
                      {a.description && (
                        <p className="text-xs text-gray-500 truncate">{a.description}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {a.agent_name && <span>{a.agent_name}</span>}
                        {a.lead_name && (
                          <span className="text-[#ff007c] font-medium"> {a.lead_name}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                      {formatActivityTime(a.completed_at || a.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Registrar actividad</h3>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.activity_type}
                onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full">
                {ACTIVITY_TYPE_KEYS.map(k => <option key={k} value={k}>{ACTIVITY_TYPES[k].label}</option>)}
              </select>
              <textarea placeholder="Descripción..." rows={3}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
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
