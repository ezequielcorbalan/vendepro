'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock,
  FileText, Settings, CheckCircle2, Target, Plus, Sparkles, BarChart3
} from 'lucide-react'
import { BarChart, Bar, XAxis, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { StatTile } from '@/components/ui/StatTile'
import {
  ACTIVITY_TYPES, ACTIVITY_TYPE_KEYS, OBJECTIVE_METRICS,
  getObjectiveSemaforo, getPeriodProgressPct, type ActivityType, type ObjectiveMetric
} from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'
import { getScopedAgentId } from '@/lib/agent-scope'
import ActivityTabs from '@/components/layout/ActivityTabs'

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
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [filterAgent, setFilterAgent] = useState(getScopedAgentId() || '')
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

  useEffect(() => {
    apiFetch('crm', '/leads').then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setLeads(d) })
      .catch(() => {})
  }, [])

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
      <ActivityTabs />
      <PageHeader
        title="Actividad Comercial"
        subtitle={`${activities.length} actividades en el período`}
        actions={
          <>
            {agents.length > 0 && (
              <Select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="w-auto">
                <option value="">Todos los agentes</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
            )}
            <Select value={period} onChange={e => setPeriod(e.target.value)} className="w-auto">
              {PERIOD_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
            <Button variant="outline" icon={<Sparkles className="w-4 h-4" />}>
              con IA
            </Button>
            <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
              Registrar
            </Button>
          </>
        }
      />

      {/* Activity type summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SUMMARY_TYPES.map(k => {
          const cfg = ACTIVITY_TYPES[k]
          const Ico = ICON_MAP[cfg.icon] || Phone
          return (
            <StatTile key={k} icon={<Ico className="w-5 h-5" />} tone={cfg.color} value={metrics[k]} label={cfg.label} />
          )
        })}
      </div>

      {/* Objectives */}
      <Card>
        <Heading level={4} className="mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-600" /> Objetivos del período
        </Heading>
        {objectivesWithProgress.length === 0 ? (
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="No hay objetivos configurados para este período"
            action={
              <a href="/configuracion/objetivos"
                className="text-sm text-primary font-medium hover:underline">
                Configurar objetivos →
              </a>
            }
          />
        ) : (
          <div className="space-y-4">
            {objectivesWithProgress.map(obj => (
              <div key={obj.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Text as="span" weight="medium" className="text-gray-700">{obj.metricLabel}</Text>
                    <StatusBadge label={obj.semaforo.label} color={obj.semaforo.color} className="shrink-0" />
                  </div>
                  <span className="text-sm text-gray-400 shrink-0 ml-4">
                    <span className="font-semibold text-ink">{obj.realized}/{obj.target}</span> ({obj.pct}%)
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
        )}
      </Card>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimos 30 días chart */}
        <Card>
          <Heading level={4} className="mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-600" /> Últimos 30 días
          </Heading>
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
            <Text weight="bold" className="text-3xl">{activities.length}</Text>
            <Text size="xs" className="text-gray-400">Total del período</Text>
          </div>
        </Card>

        {/* Actividad reciente */}
        <Card>
          <Heading level={4} className="mb-4">Actividad reciente</Heading>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-control animate-pulse" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Sin actividades en este período"
            />
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
                      <Text weight="semibold">{cfg.label}</Text>
                      {a.description && (
                        <Text size="xs" tone="muted" className="truncate">{a.description}</Text>
                      )}
                      <p className="text-xs text-gray-400">
                        {a.agent_name && <span>{a.agent_name}</span>}
                        {a.lead_name && (
                          <span className="text-primary font-medium"> {a.lead_name}</span>
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
        </Card>
      </div>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Registrar actividad"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>
              {saving ? 'Guardando...' : 'Registrar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select value={form.activity_type}
            onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
            {ACTIVITY_TYPE_KEYS.map(k => <option key={k} value={k}>{ACTIVITY_TYPES[k].label}</option>)}
          </Select>
          <Select value={form.lead_id}
            onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}>
            <option value="">Sin vincular a un lead</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
          </Select>
          <Textarea placeholder="Descripción..." rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
