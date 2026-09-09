'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, TrendingUp, TrendingDown, Target,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, Sparkles,
  BarChart2, ArrowUpRight, ExternalLink, Lightbulb, Minus, type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_SOURCES, getStageDot } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tabs } from '@/components/ui/Tabs'
import { Table, type Column } from '@/components/ui/Table'
import { ModuleGate } from '@/components/modules/ModuleGate'
import PortalCosts, { type PortalCostsData } from '@/components/marketing/PortalCosts'
import HowItWorks from '@/components/marketing/HowItWorks'
import Campaigns, { type CampaignsResponse } from '@/components/marketing/Campaigns'

type Period = 'month' | 'quarter' | 'year'
type Pipeline = 'vendedor' | 'comprador'

const PERIOD_LABELS: Record<Period, string> = { month: 'Mes', quarter: 'Trimestre', year: 'Año' }

// Las dos secciones del panel. Son dos objetivos de pauta distintos y no se
// suman: captar propietarios y conseguir compradores para una publicación.
const PIPELINE_TABS = [
  { value: 'vendedor', label: 'Captación' },
  { value: 'comprador', label: 'Demanda' },
]

const GOAL_LABEL: Record<Pipeline, string> = { vendedor: 'Captados', comprador: 'Cerrados' }

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4',
  referido: '#10B981', zonaprop: '#FF6B00', argenprop: '#8B5CF6',
  mercadolibre: '#FFE600', cartel: '#F59E0B', telefono: '#6B7280',
  manual: '#94A3B8', kiteprop: '#64748B', otro: '#CBD5E1', landing: '#EC4899',
}

/**
 * Los leads de landing se guardan como `landing:<slug>` (submit-lead-from-landing),
 * que no está en LEAD_SOURCES: se veían como texto crudo en gris, justo los que
 * vienen de la pauta.
 */
function sourceLabel(source: string): string {
  if (source?.startsWith('landing:')) return `Landing · ${source.slice(8)}`
  return LEAD_SOURCES[source as keyof typeof LEAD_SOURCES]?.label ?? source
}

function sourceColor(source: string): string {
  if (source?.startsWith('landing:')) return SOURCE_COLORS.landing!
  return SOURCE_COLORS[source] ?? '#CBD5E1'
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${MONTHS[m - 1]}`
}

/** `to` viene exclusivo del backend; para mostrar el rango se resta un día. */
function fmtRange(from: string, toExclusive: string): string {
  const last = new Date(Date.parse(toExclusive) - 86_400_000).toISOString().slice(0, 10)
  return from === last ? fmtDay(from) : `${fmtDay(from)} – ${fmtDay(last)}`
}

function fmtMoney(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('es-AR', currency
      ? { style: 'currency', currency, maximumFractionDigits: 0 }
      : { maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${currency ?? ''} ${Math.round(value).toLocaleString('es-AR')}`.trim()
  }
}

function Sparkline({ data, color = 'var(--color-primary)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible opacity-70" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Variación contra el mismo tramo del período anterior. `null` = el período
 * anterior fue cero y no hay porcentaje que calcular: se muestra "—" en vez de
 * una flecha inventada. `unit` es 'pct' para variaciones y 'pts' para la
 * conversión (una tasa se compara en puntos, no en porcentaje de porcentaje).
 */
function Delta({ value, unit = 'pct' }: { value: number | null; unit?: 'pct' | 'pts' }) {
  if (value === null) return <span className="text-xs text-gray-400">sin base previa</span>
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  const tone = value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-gray-400'
  const sign = value > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="w-3 h-3" />
      {sign}{value.toLocaleString('es-AR')}{unit === 'pct' ? '%' : ' pts'}
    </span>
  )
}

function KpiCard({ label, value, delta, deltaUnit, caption, sparkData, sparkColor }: {
  label: string; value: string
  delta?: number | null; deltaUnit?: 'pct' | 'pts'
  caption?: string; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <Card className="p-4 flex flex-col justify-between min-h-[110px]">
      <div className="flex items-start justify-between">
        <Text size="xs" weight="medium" tone="muted" className="uppercase tracking-wide leading-tight">{label}</Text>
        {sparkData && sparkData.some(v => v > 0) && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div>
        <Heading level={2} as="p" weight="bold" className="mt-1">{value}</Heading>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {delta !== undefined && <Delta value={delta ?? null} unit={deltaUnit} />}
          {caption && <span className="text-xs text-gray-400">{caption}</span>}
        </div>
      </div>
    </Card>
  )
}

// Chip de estado de una integración. Se decidió NO promoverlo al DS: 1 solo uso
// en toda la app (ver la tanda de decisiones en doc/ds-review.md).
function IntegrationBadge({ name, enabled, detail }: { name: string; enabled: boolean; detail?: string }) {
  return (
    <div className={`flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-control border ${enabled ? 'bg-success/10 border-success/30' : 'bg-gray-50 border-gray-200'}`}>
      {enabled ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${enabled ? 'text-ink' : 'text-gray-500'}`}>{name}</p>
        {detail && <p className="text-[10px] text-gray-400 truncate">{detail}</p>}
      </div>
    </div>
  )
}

interface MarketingData {
  pipeline: Pipeline
  goal_stage: string
  range: { from: string; to: string; previous_from: string; previous_to: string; elapsed_days: number }
  totals: { leads: number; goal: number; conversionRate: number }
  previous: { leads: number; goal: number; conversionRate: number }
  deltas: { leads: number | null; goal: number | null; conversionRatePoints: number }
  funnel: { stage: string; label: string; count: number; pct: number }[]
  leadsBySource: { source: string; count: number }[]
  leadsByDay: { day: string; count: number }[]
  metaEvents: Record<string, { sent: number; failed: number }>
  /** Sólo en Demanda: el gasto de portales es inventario para compradores. */
  portalCosts: PortalCostsData | null
  integration: {
    meta: { enabled: boolean; pixelId: string | null }
    ga4: { enabled: boolean; measurementId: string | null }
  }
}

function MarketingPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [pipeline, setPipeline] = useState<Pipeline>('vendedor')
  const [data, setData] = useState<MarketingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [campaignsData, setCampaignsData] = useState<CampaignsResponse | null>(null)
  // Se incrementa al cargar o borrar gasto de portales, para releer el panel.
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setLoading(true)
    apiFetch('analytics', `/marketing?period=${period}&pipeline=${pipeline}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period, pipeline, reload])

  // Las campañas se piden por sección: el backend devuelve las que tienen ese
  // objetivo, más la bandeja de las que todavía nadie clasificó.
  useEffect(() => {
    setCampaignsData(null)
    apiFetch('analytics', `/marketing/campaigns?period=${period}&pipeline=${pipeline}`)
      .then(r => r.json() as Promise<any>)
      .then(d => setCampaignsData(d))
      .catch(() => setCampaignsData({ status: 'api_error', error: 'No se pudieron cargar las campañas', campaigns: [], unclassified: [], unclassified_spend: 0 }))
  }, [period, pipeline, reload])

  const totals = data?.totals ?? { leads: 0, goal: 0, conversionRate: 0 }
  const previous = data?.previous ?? { leads: 0, goal: 0, conversionRate: 0 }
  const deltas = data?.deltas ?? { leads: null, goal: null, conversionRatePoints: 0 }
  const leadsBySource = data?.leadsBySource ?? []
  const leadsByDay = data?.leadsByDay ?? []
  const metaEvents = data?.metaEvents ?? {}
  const integration = data?.integration ?? { meta: { enabled: false, pixelId: null }, ga4: { enabled: false, measurementId: null } }
  const funnel = data?.funnel ?? []
  const range = data?.range

  const goalLabel = GOAL_LABEL[pipeline]
  const totalSourceLeads = leadsBySource.reduce((a, s) => a + s.count, 0)
  const maxSource = leadsBySource[0]?.count ?? 1
  const maxFunnel = funnel[0]?.count || 1
  const metaEventList = Object.entries(metaEvents)
    .map(([name, v]) => ({ name, sent: v.sent, failed: v.failed, total: v.sent + v.failed }))
    .sort((a, b) => b.total - a.total)
  const totalEventsToMeta = metaEventList.reduce((a, e) => a + e.sent, 0)
  const sparkData = leadsByDay.map(d => d.count)

  const insights = [
    range && deltas.leads !== null
      ? {
          icon: deltas.leads >= 0 ? TrendingUp : TrendingDown,
          text: `${totals.leads} leads en ${fmtRange(range.from, range.to)}: ${deltas.leads >= 0 ? 'un' : 'una caída de'} ${Math.abs(deltas.leads)}% contra los ${previous.leads} del mismo tramo del período anterior.`,
        }
      : null,
    leadsBySource[0]
      ? { icon: BarChart2, text: `${sourceLabel(leadsBySource[0].source)} concentra ${Math.round((leadsBySource[0].count / (totalSourceLeads || 1)) * 100)}% de los leads del período.` }
      : null,
    totals.goal > 0
      ? { icon: Target, text: `${totals.goal} ${goalLabel.toLowerCase()} sobre ${totals.leads} leads — ${totals.conversionRate.toLocaleString('es-AR')}% de conversión, ${deltas.conversionRatePoints >= 0 ? '+' : ''}${deltas.conversionRatePoints.toLocaleString('es-AR')} pts contra el período anterior.` }
      : null,
    Object.values(metaEvents).some(e => e.failed > 0)
      ? { icon: AlertCircle, text: 'Hay eventos fallidos en Meta Conversion API. Verificá la configuración en Ajustes → Marketing.' }
      : integration.meta.enabled
      ? { icon: CheckCircle2, text: `Meta Conversion API activa. ${totalEventsToMeta} eventos enviados este período.` }
      : { icon: Lightbulb, text: 'Conectá Meta Conversion API para trackear conversiones server-side y mejorar audiencias.' },
    !integration.ga4.enabled
      ? { icon: BarChart2, text: 'GA4 no configurado. Activalo en Ajustes → Marketing para medir tráfico orgánico.' }
      : null,
  ].filter(Boolean) as { icon: LucideIcon; text: string }[]

  return (
    <div className="space-y-5">

      <PageHeader
        title="Marketing"
        subtitle={range
          ? `${fmtRange(range.from, range.to)} · comparado con ${fmtRange(range.previous_from, range.previous_to)}`
          : 'Atribución de leads, eventos y conversiones'}
        actions={
          <>
            <SegmentedControl
              options={(Object.keys(PERIOD_LABELS) as Period[]).map(p => ({ value: p, label: PERIOD_LABELS[p] }))}
              value={period}
              onChange={v => setPeriod(v as Period)}
            />
            <Link href="/configuracion/marketing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-control border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Settings className="w-4 h-4" /> Configurar
            </Link>
          </>
        }
      />

      <Tabs items={PIPELINE_TABS} value={pipeline} onChange={v => setPipeline(v as Pipeline)} />

      {/* Integraciones — la config de pixel/GA4 es del usuario que mira */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-2">
          <IntegrationBadge name="Meta Conversion API" enabled={integration.meta.enabled}
            detail={integration.meta.enabled ? `Pixel: ${integration.meta.pixelId} · ${totalEventsToMeta} eventos` : 'No configurada — conectá tu Pixel'} />
          <IntegrationBadge name="Google Analytics 4" enabled={integration.ga4.enabled}
            detail={integration.ga4.enabled ? `Measurement ID: ${integration.ga4.measurementId}` : 'No configurado — activá GA4'} />
          {(!integration.meta.enabled || !integration.ga4.enabled) && (
            <Link href="/configuracion/marketing"
              className="flex items-center gap-1.5 px-3 py-2 rounded-control border border-dashed text-sm font-medium text-primary border-primary/30 hover:bg-primary/5 transition-colors whitespace-nowrap">
              <ChevronRight className="w-4 h-4" /> Completar config
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-[110px] bg-gray-100 rounded-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Leads del período" value={String(totals.leads)}
            delta={deltas.leads} caption={`vs ${previous.leads}`}
            sparkData={sparkData} sparkColor="#818CF8" />
          <KpiCard label={goalLabel} value={String(totals.goal)}
            delta={deltas.goal} caption={`vs ${previous.goal}`} />
          <KpiCard label="Tasa de conversión" value={`${totals.conversionRate.toLocaleString('es-AR')}%`}
            delta={deltas.conversionRatePoints} deltaUnit="pts"
            caption={`vs ${previous.conversionRate.toLocaleString('es-AR')}%`} />
          <KpiCard label="Eventos a Meta" value={String(totalEventsToMeta)}
            caption={integration.meta.enabled ? `${metaEventList.length} tipos de evento · toda la organización` : 'API no conectada'} />
        </div>
      )}

      {/* Embudo + fuentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><Target className="w-4 h-4 text-gray-600" /> Embudo del período</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">
              {pipeline === 'vendedor' ? 'De lead capturado a captación' : 'De consulta a operación cerrada'}
            </Text>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : totals.leads === 0 ? <Text tone="muted" className="text-center py-8">Sin leads en este período</Text>
            : (
              <div className="space-y-3">
                {funnel.map(step => (
                  <div key={step.stage}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">{step.label}</span>
                      <span className="text-xs font-semibold text-gray-700">{step.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0}%`, backgroundColor: getStageDot(step.stage) }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Card>

        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-gray-600" /> Leads por fuente</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">
              {pipeline === 'vendedor'
                ? 'Atribución del período — sólo pipeline de captación'
                : 'Atribución del período — sólo pipeline de compradores'}
            </Text>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : leadsBySource.length === 0 ? <Text tone="muted" className="text-center py-8">Sin datos de fuente</Text>
            : (
              <>
                <div className="space-y-3">
                  {leadsBySource.slice(0, 7).map(({ source, count }) => (
                    <div key={source}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600 flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: sourceColor(source) }} />
                          <span className="truncate">{sourceLabel(source)}</span>
                        </span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">
                          {count} · {totalSourceLeads > 0 ? Math.round((count / totalSourceLeads) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxSource) * 100}%`, backgroundColor: sourceColor(source) }} />
                      </div>
                    </div>
                  ))}
                </div>
                {pipeline === 'comprador' && (
                  <Text size="xs" tone="muted" className="mt-4">
                    Los portales son inventario de demanda: se pagan por publicación, no por resultado.
                    Lo que cuesta cada uno está abajo, en Costo por portal.
                  </Text>
                )}
              </>
            )}
        </Card>
      </div>

      {/* Campañas — en las dos secciones, filtradas por objetivo */}
      <Campaigns
        data={campaignsData}
        goalLabel={goalLabel}
        onChange={() => setReload(n => n + 1)}
      />

      {pipeline === 'comprador' && (
        <PortalCosts data={data?.portalCosts ?? null} onChange={() => setReload(n => n + 1)} />
      )}

      {/* Eventos a Meta */}
      <Card>
        <div className="mb-4">
          <Heading level={4} className="flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-[#1877F2]" /> Eventos enviados a Meta</Heading>
          <Text size="xs" tone="muted" className="mt-0.5">Conversion API · stages del CRM · toda la organización</Text>
        </div>
        {!integration.meta.enabled ? (
          <div className="text-center py-6">
            <Text tone="muted" className="mb-2">API no configurada</Text>
            <Link href="/configuracion/marketing" className="text-xs text-primary font-medium hover:underline">Configurar Meta →</Link>
          </div>
        ) : metaEventList.length === 0 ? (
          <Text tone="muted" className="text-center py-6">Sin eventos registrados aún</Text>
        ) : (
          <div className="space-y-1">
            {metaEventList.map(evt => (
              <div key={evt.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{evt.name}</p>
                  <p className="text-xs text-gray-400">{evt.sent} enviados{evt.failed > 0 ? ` · ${evt.failed} fallidos` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-600">{evt.total}</span>
                  {evt.failed > 0 ? <XCircle className="w-4 h-4 text-danger" /> : <CheckCircle2 className="w-4 h-4 text-success" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Insights */}
      {!loading && insights.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-brand-orange/5 border-primary/20">
          <Heading level={4} className="mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-600" /> Insights del período
          </Heading>
          <div className="space-y-2">
            {insights.map((ins, i) => {
              const Icon = ins.icon
              return (
                <Text key={i} className="text-gray-600 flex items-start gap-2">
                  <Icon className="w-4 h-4 shrink-0 text-gray-500 mt-0.5" /><span>{ins.text}</span>
                </Text>
              )
            })}
          </div>
        </Card>
      )}

      {/* Al pie y colapsado: varios números de arriba son el resultado de una
          decisión de cálculo que no se adivina mirándolos. */}
      <HowItWorks pipeline={pipeline} />
    </div>
  )
}

/**
 * Publicidad es parte del plan PRO. El gate va en la página y no en un layout
 * de /marketing porque de esa carpeta cuelgan Emails y el alias viejo de
 * automatizaciones, que son módulos distintos con su propia activación.
 */
export default function MarketingPageGated() {
  return (
    <ModuleGate module="publicidad">
      <MarketingPage />
    </ModuleGate>
  )
}
