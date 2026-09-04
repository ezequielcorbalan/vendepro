'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Target, TrendingUp, Phone, Users, Home, Eye, Calculator, Clock,
  MessageCircle, FileText, Settings, CheckCircle2, BarChart3, MapPin,
  ArrowRight, Briefcase, Loader2
} from 'lucide-react'
import {
  ACTIVITY_TYPES, OBJECTIVE_METRICS, type ActivityType, type ObjectiveMetric,
  getObjectiveSemaforo, getPeriodProgressPct, PROPERTY_STAGES
} from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'
import ActivityTabs from '@/components/layout/ActivityTabs'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { StatTile } from '@/components/ui/StatTile'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { EmptyState } from '@/components/ui/EmptyState'

const ICON_MAP: Record<string, any> = {
  Phone, MessageCircle, Users, Home, Eye, Calculator, Clock, FileText,
  Settings, CheckCircle2, Presentation: BarChart3
}

function ConvCard({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 50 ? 'text-green-600' : pct >= 25 ? 'text-yellow-600' : pct > 0 ? 'text-orange-600' : 'text-gray-400'
  return (
    <div className="flex-1 bg-gray-50 rounded-card p-4 text-center">
      <Text size="xs" className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</Text>
      <Text className={`text-2xl font-black ${color}`}>{pct}%</Text>
    </div>
  )
}

export default function MiPerformancePage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')

  // `?agent=` deja a la inmobiliaria abrir la performance de alguien del
  // equipo. Si lo pide un agente, la API le devuelve la suya igual: el
  // permiso se decide en el servidor.
  const viewedAgent = searchParams.get('agent')

  useEffect(() => {
    apiFetch('analytics', `/agent-stats${viewedAgent ? `?agent_id=${viewedAgent}` : ''}`)
      .then(r => r.json())
      .then(d => { setData(d as any); setLoading(false) })
      .catch(() => setLoading(false))
  }, [viewedAgent])

  if (loading) {
    return (
      <div className="space-y-6">
        <ActivityTabs />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }
  if (!data || data.error) {
    return (
      <div className="space-y-6">
        <ActivityTabs />
        <PageHeader title="Mi Performance" />
        <Alert tone="danger">Error cargando datos</Alert>
      </div>
    )
  }

  const actData = period === 'month' ? data.activityMonth : period === 'quarter' ? data.activityQuarter : data.activityYear
  const actMap: Record<string, number> = {}
  let totalAct = 0
  actData?.forEach((a: any) => { actMap[a.activity_type] = a.count; totalAct += a.count })

  const periodLabel = period === 'month' ? 'Este mes' : period === 'quarter' ? 'Este trimestre' : 'Este año'

  return (
    <div className="space-y-6">
      <ActivityTabs />
      {/* Header */}
      <PageHeader
        title={viewedAgent ? 'Performance del agente' : 'Mi Performance'}
        subtitle={data.agent?.full_name || 'Agente'}
        actions={
          <SegmentedControl
            options={[
              { value: 'month', label: 'Mes' },
              { value: 'quarter', label: 'Trimestre' },
              { value: 'year', label: 'Año' },
            ]}
            value={period}
            onChange={v => setPeriod(v as 'month' | 'quarter' | 'year')}
          />
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Leads totales" value={data.leadStats?.total || 0} icon={<Users className="w-5 h-5" />} tone="bg-blue-50 text-blue-600" />
        <StatTile label="Captados" value={data.leadStats?.captados || 0} icon={<CheckCircle2 className="w-5 h-5" />} tone="bg-green-50 text-green-600" />
        <StatTile label="Tasaciones" value={data.tasacionStats?.total || 0} icon={<Calculator className="w-5 h-5" />} tone="bg-pink-50 text-pink-600" />
        <StatTile label="Actividad" value={totalAct} caption={periodLabel} icon={<BarChart3 className="w-5 h-5" />} tone="bg-purple-50 text-purple-600" />
      </div>

      {/* Conversion Funnel */}
      <Card>
        <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-600" /> Tasas de conversión
        </Heading>
        <div className="flex flex-col sm:flex-row gap-3">
          <ConvCard label="Lead → Tasación" pct={data.conversions?.leadTasacion || 0} />
          <ConvCard label="Tasación → Captación" pct={data.conversions?.tasacionCaptacion || 0} />
          <ConvCard label="Lead → Captación" pct={data.conversions?.leadCaptacion || 0} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Breakdown */}
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-600" /> Actividad por tipo · {periodLabel}
          </Heading>
          <div className="space-y-2">
            {Object.entries(ACTIVITY_TYPES).map(([key, cfg]) => {
              const count = actMap[key] || 0
              const maxCount = Math.max(...Object.values(actMap), 1)
              const pct = (count / maxCount) * 100
              const Icon = ICON_MAP[cfg.icon] || Clock
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-control flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-600 truncate">{cfg.label}</span>
                      <span className="text-xs font-bold text-ink ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-brand-orange rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Objectives */}
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-600" /> Objetivos activos
          </Heading>
          {!data.objectives?.length ? (
            <EmptyState icon={<Target className="w-6 h-6" />} title="Sin objetivos cargados" />
          ) : (
            <div className="space-y-3">
              {data.objectives.map((obj: any) => {
                const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
                const periodProg = getPeriodProgressPct(obj.period_start, obj.period_end)
                let realized = 0
                if (metricCfg?.activityTypes?.length) {
                  metricCfg.activityTypes.forEach((at: string) => { realized += (actMap[at] || 0) })
                }
                const semaforo = getObjectiveSemaforo(realized, obj.target, periodProg)
                const pct = obj.target > 0 ? Math.min(Math.round((realized / obj.target) * 100), 100) : 0

                return (
                  <div key={obj.id} className="border border-gray-100 rounded-control p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">{metricCfg?.label || obj.metric}</span>
                      <StatusBadge label={semaforo.label} color={semaforo.color} />
                    </div>
                    <div className="flex items-end justify-between mb-1.5">
                      <span className="text-lg font-black text-ink">{realized}<span className="text-sm font-normal text-gray-400">/{obj.target}</span></span>
                      <span className="text-xs text-gray-400">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          semaforo.level === 'green' ? 'bg-green-500' :
                          semaforo.level === 'yellow' ? 'bg-yellow-500' :
                          semaforo.level === 'orange' ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
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
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline comercial */}
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-600" /> Pipeline comercial
          </Heading>
          <div className="space-y-2">
            {Object.keys(PROPERTY_STAGES).map(key => {
              const statKey = (key === 'captacion' || key === 'captada') ? 'captadas' : key === 'publicada' ? 'publicadas' : key === 'reservada' ? 'reservadas' : key === 'vendida' ? 'vendidas' : 'captadas'
              const val = data.propertyStats?.[statKey] || 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <PropertyStageBadge stage={key} />
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-sm font-bold text-ink">{val}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Top barrios */}
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-600" /> Barrios más trabajados
          </Heading>
          {!data.topBarrios?.length ? (
            <EmptyState icon={<MapPin className="w-6 h-6" />} title="Sin datos de barrios" />
          ) : (
            <div className="space-y-2">
              {data.topBarrios.map((b: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1">{b.neighborhood}</span>
                  <span className="text-sm font-bold text-ink">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quarter comparison */}
      {data.quarterComparison && (
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-600" /> Comparación trimestral
          </Heading>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">Trim. anterior</p>
              <p className="text-xl font-black text-gray-400">{data.quarterComparison.previous}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">Trim. actual</p>
              <p className="text-xl font-black text-ink">{data.quarterComparison.current}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-400 uppercase">Variación</p>
              <p className={`text-xl font-black ${data.quarterComparison.change > 0 ? 'text-green-600' : data.quarterComparison.change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {data.quarterComparison.change > 0 ? '+' : ''}{data.quarterComparison.change}%
              </p>
            </div>
          </div>
          {data.quarterComparison.currentByType?.length > 0 && (
            <div className="space-y-1.5">
              {data.quarterComparison.currentByType.map((curr: any) => {
                const prev = data.quarterComparison.previousByType?.find((p: any) => p.activity_type === curr.activity_type)
                const prevCount = prev?.count || 0
                const diff = curr.count - prevCount
                const cfg = ACTIVITY_TYPES[curr.activity_type as ActivityType]
                return (
                  <div key={curr.activity_type} className="flex items-center gap-2 text-xs">
                    <span className="w-24 text-gray-500 truncate">{cfg?.label || curr.activity_type}</span>
                    <span className="text-gray-400 w-8 text-right">{prevCount}</span>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    <span className="font-bold text-ink w-8">{curr.count}</span>
                    <span className={`text-[10px] font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Weekly trend */}
      {data.weeklyTrend?.length > 0 && (
        <Card>
          <Heading level={4} as="h2" className="mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-600" /> Evolución semanal
          </Heading>
          <div className="flex items-end gap-2 h-24">
            {data.weeklyTrend.map((w: any, i: number) => {
              const maxW = Math.max(...data.weeklyTrend.map((x: any) => x.count), 1)
              const h = (w.count / maxW) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-gray-600">{w.count}</span>
                  <div
                    className="w-full bg-gradient-to-t from-primary to-brand-orange rounded-t-md"
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                  <span className="text-[8px] text-gray-400">S{w.week?.split('W')[1]}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
