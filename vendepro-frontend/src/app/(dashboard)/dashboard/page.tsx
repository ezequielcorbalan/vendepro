'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, Phone, CalendarDays, Target, TrendingUp,
  Clock, CheckCircle2, BarChart3, ChevronRight,
  Home, Calculator, Activity, MessageCircle
} from 'lucide-react'
import { LEAD_STAGES, LEAD_PIPELINE_STAGES, EVENT_TYPES, getStageConfig } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'
import { getCurrentUser, isOnboardingDone, markOnboardingDone } from '@/lib/auth'
import OnboardingModal from '@/components/onboarding/OnboardingModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Input'

function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-2">
      {data.map((item) => {
        const pct = Math.max((item.count / max) * 100, 8)
        const cfg = getStageConfig(item.stage)
        return (
          <div key={item.stage} className="flex items-center gap-2 sm:gap-3">
            <div className="w-20 sm:w-28 text-[10px] sm:text-xs text-gray-600 text-right truncate">{item.stage}</div>
            <div className="flex-1 h-7 bg-gray-50 rounded overflow-hidden">
              <div
                className={`h-full rounded flex items-center px-2 transition-all duration-500 ${cfg.color}`}
                style={{ width: `${pct}%` }}
              >
                <span className="text-xs font-semibold">{item.count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeeklyChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return (
    <div className="flex items-end gap-1 sm:gap-2 h-32">
      {data.map((item) => {
        const h = Math.max((item.count / max) * 100, 4)
        const d = new Date(item.day + 'T12:00:00')
        const dayName = dayNames[d.getDay()]
        return (
          <div key={item.day} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs text-gray-600 font-medium">{item.count}</span>
            <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '100px' }}>
              <div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-pink-500 to-pink-400 rounded-t transition-all"
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{dayName}</span>
          </div>
        )
      })}
    </div>
  )
}

function KPICard({ icon, label, value, color, href }: { icon: React.ReactNode; label: string; value: number | string; color: string; href?: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    pink: 'bg-primary/10 text-primary',
    amber: 'bg-amber-50 text-amber-600',
  }
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-control flex items-center justify-center mb-2 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-ink">{value}</p>
      <Text size="xs" tone="muted" className="mt-0.5">{label}</Text>
    </>
  )
  // ds-todo: candidato a variante "KPICard" del DS (Card no rinde <a>).
  const baseClass = 'bg-white rounded-card border border-gray-200 shadow-card p-3 sm:p-4 relative overflow-hidden'
  if (href) {
    return (
      <a href={href} className={`${baseClass} transition-shadow hover:shadow-md block`}>
        {inner}
      </a>
    )
  }
  return (
    <div className={baseClass}>
      {inner}
    </div>
  )
}

export default function DashboardCRM() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Período que acota SOLO el funnel (los KPIs/pipeline son de toda la historia)
  const [period, setPeriod] = useState<string>('all')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingUser, setOnboardingUser] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (user && !isOnboardingDone(user.id)) {
      setOnboardingUser(user.full_name || '')
      setShowOnboarding(true)
    }
  }, [])

  useEffect(() => {
    // Skeleton solo en la primera carga; al cambiar el período del funnel se
    // actualiza sin parpadear el resto del dashboard.
    if (!data) setLoading(true)
    apiFetch('analytics', `/dashboard?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-card" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-200 rounded-card" />
          <div className="h-64 bg-gray-200 rounded-card" />
        </div>
      </div>
    )
  }

  if (!data || data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <Alert tone="danger" title="Error al cargar el dashboard" />
      </div>
    )
  }

  const { leads, overdueLeads, tasaciones, activity, weeklyActivity, todayEvents, pendingFollowups, agentPerformance, funnel, conversionRate, recentActivities, pipelineBreakdown } = data

  // La API devuelve pipelineBreakdown con las claves crudas de etapa
  // (nuevo, asignado, presentada, invalido, finalizado…). Se usa como
  // fuente única para el pipeline y los KPIs, evitando desajustes de nombres.
  const sb: Record<string, number> = pipelineBreakdown || {}
  const ACTIVE_STAGES = ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento']
  const activeLeads = ACTIVE_STAGES.reduce((sum, s) => sum + (sb[s] || 0), 0)
  const captaciones = sb['captado'] || 0

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const weekData = last7.map(day => ({
    day,
    count: weeklyActivity?.find((w: any) => w.day === day)?.count || 0
  }))

  const handleCloseOnboarding = () => {
    const user = getCurrentUser()
    if (user) markOnboardingDone(user.id)
    setShowOnboarding(false)
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Dashboard CRM"
        subtitle="Resumen ejecutivo del negocio"
        actions={
          <Link href="/leads" className="bg-primary text-white px-3 py-1.5 rounded-control text-xs font-medium hover:bg-primary-hover inline-flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Ver leads</span>
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={<Users className="w-5 h-5" />} label="Leads activos" value={activeLeads} color="blue" href="/leads" />
        <KPICard icon={<Phone className="w-5 h-5" />} label="Contactados" value={sb['contactado'] || 0} color="cyan" href="/leads?stage=contactado" />
        <KPICard icon={<Calculator className="w-5 h-5" />} label="Tasaciones" value={tasaciones?.total || 0} color="purple" href="/tasaciones" />
        <KPICard icon={<Home className="w-5 h-5" />} label="Captaciones" value={captaciones} color="green" href="/propiedades/pipeline" />
        <KPICard icon={<Activity className="w-5 h-5" />} label="Actividad (30d)" value={activity?.total || 0} color="pink" href="/actividades" />
        <KPICard icon={<Target className="w-5 h-5" />} label="Conversión" value={`${conversionRate || 0}%`} color="amber" href="/mi-performance" />
      </div>

      {(overdueLeads > 0 || (todayEvents && todayEvents.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {overdueLeads > 0 && (
            <Link href="/leads?sort=urgency" className="block">
              <Alert tone="danger" title={`${overdueLeads} lead${overdueLeads > 1 ? 's' : ''} vencido${overdueLeads > 1 ? 's' : ''}`} className="h-full p-3 transition-opacity hover:opacity-85">
                Sin contactar o sin actividad
              </Alert>
            </Link>
          )}
          {pendingFollowups && pendingFollowups.length > 0 && (
            <Link href="/leads?sort=urgency" className="block">
              <Alert tone="warning" title={`${pendingFollowups.length} seguimiento${pendingFollowups.length > 1 ? 's' : ''} pendiente${pendingFollowups.length > 1 ? 's' : ''}`} className="h-full p-3 transition-opacity hover:opacity-85">
                Próximas acciones definidas
              </Alert>
            </Link>
          )}
          {todayEvents && todayEvents.length > 0 && (
            <Link href="/calendario" className="block">
              <Alert tone="info" title={`${todayEvents.length} evento${todayEvents.length > 1 ? 's' : ''} hoy`} className="h-full p-3 transition-opacity hover:opacity-85">
                Calendario del día
              </Alert>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <Heading level={4} as="h2" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-600" /> Funnel de conversión
            </Heading>
            <Select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-auto px-2.5 py-1.5 text-xs text-gray-600"
            >
              <option value="all">Todo el historial</option>
              <optgroup label="Período calendario">
                <option value="cal_month">Este mes</option>
                <option value="cal_quarter">Este trimestre</option>
                <option value="cal_year">Este año</option>
              </optgroup>
              <optgroup label="Últimos…">
                <option value="week">Últimos 7 días</option>
                <option value="month">Últimos 30 días</option>
                <option value="quarter">Últimos 90 días</option>
                <option value="year">Último año</option>
              </optgroup>
            </Select>
          </div>
          <FunnelChart data={funnel || []} />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <Heading level={4} as="h2" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-600" /> Actividad semanal
            </Heading>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {activity?.llamadas || 0}</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {activity?.reuniones || 0}</span>
              <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5" /> {activity?.visitas || 0}</span>
            </div>
          </div>
          {weekData.some(d => d.count > 0) ? (
            <WeeklyChart data={weekData} />
          ) : (
            <div className="flex items-center justify-center h-32">
              <Text tone="muted">Sin actividad registrada esta semana</Text>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card className="p-4 sm:p-5">
          <Heading level={4} as="h2" className="mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-600" /> Hoy
          </Heading>
          {todayEvents && todayEvents.length > 0 ? (
            <div className="space-y-2">
              {todayEvents.slice(0, 5).map((ev: any) => {
                const cfg = EVENT_TYPES[ev.event_type as keyof typeof EVENT_TYPES] || EVENT_TYPES.otro
                const time = ev.start_at ? new Date(ev.start_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''
                return (
                  <div key={ev.id} className="flex items-center gap-2 p-2 rounded-control hover:bg-gray-50">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{time}</span>
                    <span className="text-sm text-gray-700 truncate flex-1">{ev.title}</span>
                    {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </div>
                )
              })}
              {todayEvents.length > 5 && (
                <Link href="/calendario" className="text-xs text-primary hover:underline">
                  +{todayEvents.length - 5} más
                </Link>
              )}
            </div>
          ) : (
            <Text tone="muted">Sin eventos programados</Text>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <Heading level={4} as="h2" className="mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-600" /> Seguimientos
          </Heading>
          {pendingFollowups && pendingFollowups.length > 0 ? (
            <div className="space-y-2">
              {pendingFollowups.slice(0, 5).map((f: any) => (
                <Link key={f.id} href={`/leads/${f.id}`} className="flex items-center gap-2 p-2 rounded-control hover:bg-gray-50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{f.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{f.next_step}</p>
                  </div>
                  {f.next_step_date && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(f.next_step_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : (
            <Text tone="muted">Sin seguimientos definidos</Text>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <Heading level={4} as="h2" className="mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-600" /> Equipo
          </Heading>
          {agentPerformance && agentPerformance.length > 0 ? (
            <div className="space-y-3">
              {agentPerformance.map((agent: any) => {
                const convRate = agent.total_leads > 0
                  ? Math.round((agent.captados / agent.total_leads) * 100)
                  : 0
                return (
                  <div key={agent.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate">{agent.full_name}</span>
                      <span className="text-xs text-gray-400">{agent.actividad_mes} act.</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{agent.total_leads} leads</span>
                      <span>·</span>
                      <span>{agent.captados} capt.</span>
                      <span>·</span>
                      <span className={convRate >= 20 ? 'text-green-600' : convRate >= 10 ? 'text-yellow-600' : 'text-red-500'}>
                        {convRate}% conv.
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full transition-all"
                        style={{ width: `${Math.min(convRate * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <Text tone="muted">Pipeline personal</Text>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-100 text-blue-800 rounded-control p-2">
                  <p className="text-xl font-bold">{leads?.total || 0}</p>
                  <p className="text-xs font-normal">Mis leads</p>
                </div>
                <div className={`rounded-control p-2 ${LEAD_STAGES.captado.color}`}>
                  <p className="text-xl font-bold">{leads?.captados || 0}</p>
                  <p className="text-xs font-normal">Captados</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {recentActivities && recentActivities.length > 0 && (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <Heading level={4} as="h2" className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-600" /> Actividad reciente
            </Heading>
            <Link href="/actividades" className="text-xs text-primary hover:underline">Ver todo →</Link>
          </div>
          <div className="space-y-1.5">
            {recentActivities.slice(0, 6).map((a: any) => {
              const TypeIcon = a.activity_type === 'llamada' ? Phone : a.activity_type === 'whatsapp' ? MessageCircle : a.activity_type === 'reunion' ? Users : a.activity_type === 'visita_captacion' ? Home : a.activity_type === 'tasacion' ? Calculator : Activity
              const mins = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 60000)
              const timeAgo = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`
              return (
                <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-control hover:bg-gray-50">
                  <TypeIcon className="w-4 h-4 text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{a.description || a.activity_type}</p>
                    <p className="text-[10px] text-gray-400 truncate">{a.agent_name}{a.lead_name ? ` · ${a.lead_name}` : ''}</p>
                  </div>
                  <span className="text-[10px] text-gray-300 shrink-0">{timeAgo}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <Heading level={4} as="h2" className="mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-600" /> Pipeline de leads
        </Heading>
        {/* Sólo las etapas activas (LEAD_PIPELINE_STAGES excluye perdido/inválido/finalizado:
            son resultados de cierre, no "pipeline" — se ven en el funnel de conversión). */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {LEAD_PIPELINE_STAGES.map(key => {
            const cfg = LEAD_STAGES[key]
            return (
              <Link
                key={key}
                href={`/leads?stage=${key}`}
                className={`flex flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition-opacity hover:opacity-80 ${cfg.color}`}
              >
                <p className="text-xl font-bold">{sb[key] || 0}</p>
                <p className="text-xs font-normal">{cfg.label}</p>
              </Link>
            )
          })}
        </div>
      </Card>

      {showOnboarding && <OnboardingModal userName={onboardingUser} onClose={handleCloseOnboarding} />}
    </div>
  )
}
