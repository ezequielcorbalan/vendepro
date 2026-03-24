'use client'
import { useState, useEffect } from 'react'
import {
  Target, TrendingUp, Phone, Users, Home, Eye, Calculator, Clock,
  MessageCircle, FileText, Settings, CheckCircle2, BarChart3, MapPin,
  ArrowRight, Briefcase
} from 'lucide-react'
import {
  ACTIVITY_TYPES, OBJECTIVE_METRICS, type ActivityType, type ObjectiveMetric,
  getObjectiveSemaforo, getPeriodProgressPct, PROPERTY_STAGES
} from '@/lib/crm-config'

const ICON_MAP: Record<string, any> = {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock, FileText,
  Settings, CheckCircle2, Presentation: BarChart3
}

export default function MiPerformancePage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  useEffect(() => {
    fetch('/api/agent-stats').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="bg-gray-100 rounded-xl h-32" />)}</div>
  if (!data || data.error) return <div className="bg-red-50 text-red-600 rounded-xl p-6">Error cargando datos</div>

  const actData = period === 'month' ? data.activityMonth : period === 'quarter' ? data.activityQuarter : data.activityYear
  const actMap: Record<string, number> = {}
  let totalAct = 0
  actData?.forEach((a: any) => { actMap[a.activity_type] = a.count; totalAct += a.count })

  const periodLabel = period === 'month' ? 'Este mes' : period === 'quarter' ? 'Este trimestre' : 'Este año'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Mi Performance</h1>
          <p className="text-sm text-gray-500">{data.agent?.full_name || 'Agente'}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['month', 'quarter', 'year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {p === 'month' ? 'Mes' : p === 'quarter' ? 'Trimestre' : 'Año'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Leads totales" value={data.leadStats?.total || 0} icon={<Users className="w-4 h-4" />} color="text-blue-600 bg-blue-50" />
        <KPI label="Captados" value={data.leadStats?.captados || 0} icon={<CheckCircle2 className="w-4 h-4" />} color="text-green-600 bg-green-50" />
        <KPI label="Tasaciones" value={data.tasacionStats?.total || 0} icon={<Calculator className="w-4 h-4" />} color="text-pink-600 bg-pink-50" />
        <KPI label="Actividad" value={totalAct} sub={periodLabel} icon={<BarChart3 className="w-4 h-4" />} color="text-purple-600 bg-purple-50" />
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#ff007c]" /> Tasas de conversión
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <ConvCard label="Lead → Tasación" pct={data.conversions?.leadTasacion || 0} />
          <ConvCard label="Tasación → Captación" pct={data.conversions?.tasacionCaptacion || 0} />
          <ConvCard label="Lead → Captación" pct={data.conversions?.leadCaptacion || 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" /> Actividad por tipo · {periodLabel}
          </h2>
          <div className="space-y-2">
            {Object.entries(ACTIVITY_TYPES).map(([key, cfg]) => {
              const count = actMap[key] || 0
              const maxCount = Math.max(...Object.values(actMap), 1)
              const pct = (count / maxCount) * 100
              const Icon = ICON_MAP[cfg.icon] || Clock
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-600 truncate">{cfg.label}</span>
                      <span className="text-xs font-bold text-gray-800 ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-500" /> Objetivos activos
          </h2>
          {data.objectives?.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin objetivos cargados</p>
          ) : (
            <div className="space-y-3">
              {data.objectives?.map((obj: any) => {
                const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
                const periodProg = getPeriodProgressPct(obj.period_start, obj.period_end)
                // Calculate realized from activity data
                let realized = 0
                if (metricCfg?.activityTypes?.length) {
                  metricCfg.activityTypes.forEach((at: string) => { realized += (actMap[at] || 0) })
                }
                const semaforo = getObjectiveSemaforo(realized, obj.target, periodProg)
                const pct = obj.target > 0 ? Math.min(Math.round((realized / obj.target) * 100), 100) : 0

                return (
                  <div key={obj.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">{metricCfg?.label || obj.metric}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${semaforo.color}`}>{semaforo.label}</span>
                    </div>
                    <div className="flex items-end justify-between mb-1.5">
                      <span className="text-lg font-black text-gray-800">{realized}<span className="text-sm font-normal text-gray-400">/{obj.target}</span></span>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        semaforo.level === 'green' ? 'bg-green-500' :
                        semaforo.level === 'yellow' ? 'bg-yellow-500' :
                        semaforo.level === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-400">Período: {periodProg}%</span>
                      <span className="text-[10px] text-gray-400">Faltan: {Math.max(0, obj.target - realized)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline comercial */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-500" /> Pipeline comercial
          </h2>
          <div className="space-y-2">
            {Object.entries(PROPERTY_STAGES).map(([key, cfg]) => {
              const count = data.propertyStats?.[key === 'documentacion' ? 'captadas' : key + 's'] || data.propertyStats?.[key] || 0
              // map key to stat
              const statKey = key === 'captada' ? 'captadas' : key === 'publicada' ? 'publicadas' : key === 'reservada' ? 'reservadas' : key === 'vendida' ? 'vendidas' : 'captadas'
              const val = data.propertyStats?.[statKey] || 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-sm font-bold text-gray-800">{val}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top barrios */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" /> Barrios más trabajados
          </h2>
          {data.topBarrios?.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin datos de barrios</p>
          ) : (
            <div className="space-y-2">
              {data.topBarrios?.map((b: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1">{b.neighborhood}</span>
                  <span className="text-sm font-bold text-gray-800">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly trend */}
      {data.weeklyTrend?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Evolución semanal
          </h2>
          <div className="flex items-end gap-2 h-24">
            {data.weeklyTrend.map((w: any, i: number) => {
              const maxW = Math.max(...data.weeklyTrend.map((x: any) => x.count), 1)
              const h = (w.count / maxW) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-600">{w.count}</span>
                  <div className="w-full bg-gradient-to-t from-[#ff007c] to-[#ff8017] rounded-t-md" style={{ height: `${Math.max(h, 4)}%` }} />
                  <span className="text-[8px] text-gray-400">S{w.week?.split('W')[1]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ label, value, sub, icon, color }: { label: string; value: number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-800">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ConvCard({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 50 ? 'text-green-600' : pct >= 25 ? 'text-yellow-600' : pct > 0 ? 'text-orange-600' : 'text-gray-400'
  return (
    <div className="flex-1 bg-gray-50 rounded-xl p-4 text-center">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{pct}%</p>
    </div>
  )
}
