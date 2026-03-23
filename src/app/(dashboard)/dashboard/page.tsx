'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Users, Phone, CalendarDays, Target, TrendingUp, AlertTriangle,
  Clock, ArrowRight, CheckCircle2, BarChart3, ChevronRight,
  MessageCircle, Home, Calculator, Activity
} from 'lucide-react'
import { LEAD_STAGES, EVENT_TYPES } from '@/lib/crm-config'

// ── Funnel SVG ─────────────────────────────────────────────
function FunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const colors = ['#3B82F6', '#06B6D4', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#22C55E']
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const pct = Math.max((item.count / max) * 100, 8)
        return (
          <div key={item.stage} className="flex items-center gap-2 sm:gap-3">
            <div className="w-20 sm:w-28 text-[10px] sm:text-xs text-gray-600 text-right truncate">{item.stage}</div>
            <div className="flex-1 h-7 bg-gray-50 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center px-2 transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
              >
                <span className="text-white text-xs font-semibold">{item.count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Weekly bar chart ───────────────────────────────────────
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

export default function DashboardCRM() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard-crm')
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!data || data.error) {
    return <div className="text-center py-12 text-gray-500">Error al cargar el dashboard</div>
  }

  const { leads, overdueLeads, tasaciones, activity, weeklyActivity, todayEvents, pendingFollowups, agentPerformance, funnel, conversionRate } = data

  // Build full 7-day array filling gaps
  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const weekData = last7.map(day => ({
    day,
    count: weeklyActivity?.find((w: any) => w.day === day)?.count || 0
  }))

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Dashboard CRM</h1>
          <p className="text-gray-500 text-sm">Resumen ejecutivo del negocio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/leads" className="bg-pink-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-pink-700 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nuevo lead</span><span className="sm:hidden">Lead</span>
          </Link>
          <Link href="/dashboard/mi-performance" className="text-xs text-pink-600 hover:text-pink-700 flex items-center gap-1 border border-pink-200 px-2.5 py-1.5 rounded-lg">
            Mi performance
          </Link>
          <Link href="/dashboard/reportes" className="hidden sm:flex text-xs text-gray-400 hover:text-gray-600 items-center gap-1">
            Reportes <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard icon={<Users className="w-5 h-5" />} label="Leads activos" value={((leads.total || 0) - (leads.perdidos || 0) - (leads.captados || 0))} color="blue" />
        <KPICard icon={<Phone className="w-5 h-5" />} label="Contactados" value={leads.contactados || 0} color="cyan" />
        <KPICard icon={<Calculator className="w-5 h-5" />} label="Tasaciones" value={tasaciones.total || 0} color="purple" />
        <KPICard icon={<Home className="w-5 h-5" />} label="Captaciones" value={tasaciones.captadas || 0} color="green" />
        <KPICard icon={<Activity className="w-5 h-5" />} label="Actividad (30d)" value={activity.total || 0} color="pink" />
        <KPICard icon={<Target className="w-5 h-5" />} label="Conversión" value={`${conversionRate}%`} color="amber" />
      </div>

      {/* ── Alertas operativas ── */}
      {(overdueLeads > 0 || (todayEvents && todayEvents.length > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {overdueLeads > 0 && (
            <Link href="/leads" className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">{overdueLeads} lead{overdueLeads > 1 ? 's' : ''} vencido{overdueLeads > 1 ? 's' : ''}</p>
                <p className="text-xs text-red-500">Sin contactar o sin actividad</p>
              </div>
            </Link>
          )}
          {pendingFollowups && pendingFollowups.length > 0 && (
            <Link href="/leads" className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors">
              <Clock className="w-5 h-5 text-yellow-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-700">{pendingFollowups.length} seguimiento{pendingFollowups.length > 1 ? 's' : ''} pendiente{pendingFollowups.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-yellow-500">Próximas acciones definidas</p>
              </div>
            </Link>
          )}
          {todayEvents && todayEvents.length > 0 && (
            <Link href="/calendario" className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <CalendarDays className="w-5 h-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700">{todayEvents.length} evento{todayEvents.length > 1 ? 's' : ''} hoy</p>
                <p className="text-xs text-blue-500">Calendario del día</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Funnel */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-500" /> Funnel de conversión
            </h2>
            <span className="text-xs text-gray-400">lead → captación</span>
          </div>
          <FunnelChart data={funnel || []} />
        </div>

        {/* Actividad semanal */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-pink-500" /> Actividad semanal
            </h2>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>📞 {activity.llamadas || 0}</span>
              <span>🤝 {activity.reuniones || 0}</span>
              <span>🏠 {activity.visitas || 0}</span>
            </div>
          </div>
          {weekData.some(d => d.count > 0) ? (
            <WeeklyChart data={weekData} />
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Sin actividad registrada esta semana
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Eventos de hoy */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" /> Hoy
          </h2>
          {todayEvents && todayEvents.length > 0 ? (
            <div className="space-y-2">
              {todayEvents.slice(0, 5).map((ev: any) => {
                const cfg = EVENT_TYPES[ev.event_type as keyof typeof EVENT_TYPES] || EVENT_TYPES.otro
                const time = ev.start_at ? new Date(ev.start_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''
                return (
                  <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{time}</span>
                    <span className="text-sm text-gray-700 truncate flex-1">{ev.title}</span>
                    {ev.completed === 1 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  </div>
                )
              })}
              {todayEvents.length > 5 && (
                <Link href="/calendario" className="text-xs text-pink-600 hover:underline">
                  +{todayEvents.length - 5} más
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin eventos programados</p>
          )}
        </div>

        {/* Seguimientos pendientes */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" /> Seguimientos
          </h2>
          {pendingFollowups && pendingFollowups.length > 0 ? (
            <div className="space-y-2">
              {pendingFollowups.slice(0, 5).map((f: any) => (
                <Link key={f.id} href={`/leads/${f.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{f.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{f.next_step}</p>
                  </div>
                  {f.next_step_date && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {new Date(f.next_step_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-pink-500" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin seguimientos definidos</p>
          )}
        </div>

        {/* Performance por agente */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /> Equipo
          </h2>
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
              <p className="text-sm text-gray-400">Pipeline personal</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-lg font-semibold text-blue-700">{leads.total || 0}</p>
                  <p className="text-[10px] text-blue-500">Mis leads</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-lg font-semibold text-green-700">{leads.captados || 0}</p>
                  <p className="text-[10px] text-green-500">Captados</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pipeline detail cards (mobile-friendly) ── */}
      <div className="bg-white rounded-xl border p-4 sm:p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-pink-500" /> Pipeline de leads
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
          {Object.entries(LEAD_STAGES).map(([key, cfg]) => {
            const countMap: any = {
              nuevo: leads.nuevos, asignado: leads.asignados, contactado: leads.contactados,
              calificado: leads.calificados, seguimiento: leads.seguimiento, en_tasacion: leads.en_tasacion,
              presentada: leads.presentada, captado: leads.captados, perdido: leads.perdidos
            }
            return (
              <Link key={key} href={`/leads?stage=${key}`} className="text-center p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <p className="text-lg sm:text-xl font-semibold text-gray-800">{countMap[key] || 0}</p>
                <p className={`text-[10px] sm:text-xs px-1 py-0.5 rounded-full ${cfg.color} mt-1`}>{cfg.label}</p>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card component ─────────────────────────────────────
function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    pink: 'bg-pink-50 text-pink-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border p-3 sm:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}
