'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, Target, BarChart3, Users, Phone, Home, TrendingUp,
  MapPin, Activity, Calculator, Clock
} from 'lucide-react'
import {
  ACTIVITY_TYPES, OBJECTIVE_METRICS, getObjectiveSemaforo,
  getPeriodProgressPct, type ActivityType, type ObjectiveMetric
} from '@/lib/crm-config'

export default function MiPerformancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agent-stats')
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data || data.error) return <div className="text-center py-12 text-gray-500">Error al cargar</div>

  const { agent, leads, tasaciones, actByType, actByMonth, topBarrios, topOps, objectives, periodCounts, convLeadTasa, convTasaCap } = data

  // Enrich objectives
  const enrichedObjectives = (objectives || []).map((obj: any) => {
    const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
    const types = (metricCfg?.activityTypes || []) as readonly string[]
    const realized = types.length > 0
      ? (actByType || []).filter((a: any) => types.includes(a.activity_type)).reduce((s: number, a: any) => s + a.count, 0)
      : 0
    const periodPct = getPeriodProgressPct(obj.period_start, obj.period_end)
    const semaforo = getObjectiveSemaforo(realized, obj.target, periodPct)
    const pct = obj.target > 0 ? Math.round((realized / obj.target) * 100) : 0
    return { ...obj, realized, pct, semaforo, metricLabel: metricCfg?.label || obj.metric }
  })

  // Activity type map for display
  const actMap: Record<string, number> = {}
  ;(actByType || []).forEach((a: any) => { actMap[a.activity_type] = a.count })

  // Monthly chart (last 6 months)
  const months = actByMonth || []
  const maxMonth = Math.max(...months.map((m: any) => m.count), 1)

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-1">
          <ChevronLeft className="w-3 h-3" /> Dashboard
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
          {agent?.full_name || 'Mi Performance'}
        </h1>
        <p className="text-gray-500 text-sm">Tablero de comando personal</p>
      </div>

      {/* KPI cards — Period summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KPI label="Este mes" value={periodCounts?.month_count || 0} sub="actividades" color="pink" />
        <KPI label="Trimestre" value={periodCounts?.quarter_count || 0} sub="actividades" color="purple" />
        <KPI label="Este año" value={periodCounts?.year_count || 0} sub="actividades" color="blue" />
        <KPI label="Leads activos" value={(leads?.total || 0) - (leads?.perdidos || 0) - (leads?.captados || 0)} sub="en pipeline" color="cyan" />
      </div>

      {/* Row 2: Conversion + Tasaciones */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KPI label="Tasaciones" value={tasaciones?.total || 0} sub="realizadas" color="orange" />
        <KPI label="Captaciones" value={tasaciones?.captadas || 0} sub="logradas" color="green" />
        <KPI label="Lead→Tasación" value={`${convLeadTasa}%`} sub="conversión" color="purple" />
        <KPI label="Tasación→Capt." value={`${convTasaCap}%`} sub="conversión" color="emerald" />
      </div>

      {/* Objectives with semáforo */}
      {enrichedObjectives.length > 0 && (
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-500" /> Objetivos activos
          </h2>
          <div className="space-y-3">
            {enrichedObjectives.map((obj: any) => (
              <div key={obj.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-700">{obj.metricLabel}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className={`absolute left-0 top-0 h-full rounded-full ${obj.semaforo.level === 'green' ? 'bg-green-500' : obj.semaforo.level === 'yellow' ? 'bg-yellow-500' : obj.semaforo.level === 'orange' ? 'bg-orange-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(obj.pct, 100)}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-800">{obj.realized}/{obj.target}</p>
                  <p className="text-[10px] text-gray-400">{obj.pct}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity breakdown + Monthly evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity by type (last 30 days) */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-pink-500" /> Actividad (30 días)
          </h2>
          <div className="space-y-2">
            {(['llamada', 'whatsapp', 'reunion', 'visita_captacion', 'visita_comprador', 'tasacion', 'seguimiento'] as ActivityType[]).map(key => {
              const cfg = ACTIVITY_TYPES[key]
              const count = actMap[key] || 0
              const maxAct = Math.max(...Object.values(actMap), 1)
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-24 sm:w-28 truncate">{cfg.label}</span>
                  <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
                    <div className={`h-full rounded ${cfg.color.split(' ')[1] || 'bg-pink-100'}`} style={{ width: `${Math.max((count / maxAct) * 100, 2)}%` }}>
                      <span className="text-[10px] font-semibold px-1.5 leading-5">{count}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Monthly evolution */}
        <div className="bg-white rounded-xl border p-4 sm:p-5">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pink-500" /> Evolución mensual
          </h2>
          {months.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {months.map((m: any) => {
                const h = Math.max((m.count / maxMonth) * 100, 4)
                const label = m.month.split('-')[1]
                const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                const monthName = monthNames[parseInt(label) - 1] || label
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-600">{m.count}</span>
                    <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '80px' }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-pink-500 to-pink-400 rounded-t" style={{ height: `${h}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{monthName}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
          )}
        </div>
      </div>

      {/* Bottom: Top barrios + Top operaciones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-500" /> Barrios más trabajados
          </h3>
          {topBarrios && topBarrios.length > 0 ? (
            <div className="space-y-1.5">
              {topBarrios.map((b: any, i: number) => (
                <div key={b.neighborhood} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 truncate">{b.neighborhood}</span>
                  <span className="text-gray-800 font-medium shrink-0 ml-2">{b.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">Sin datos</p>}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Home className="w-4 h-4 text-orange-500" /> Operaciones
          </h3>
          {topOps && topOps.length > 0 ? (
            <div className="space-y-1.5">
              {topOps.map((o: any) => (
                <div key={o.operation} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">{o.operation}</span>
                  <span className="text-gray-800 font-medium">{o.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">Sin datos</p>}
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    pink: 'bg-pink-50 text-pink-600', purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600', cyan: 'bg-cyan-50 text-cyan-600',
    orange: 'bg-orange-50 text-orange-600', green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="bg-white rounded-xl border p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
      <p className={`text-[10px] mt-0.5 ${colors[color]?.split(' ')[1] || 'text-gray-400'}`}>{sub}</p>
    </div>
  )
}
