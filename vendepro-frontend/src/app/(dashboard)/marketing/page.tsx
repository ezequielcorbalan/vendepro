'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, TrendingUp, TrendingDown, Users, Target,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, Sparkles,
  BarChart2, ArrowUpRight, ExternalLink, Lightbulb, type LucideIcon,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_SOURCES, getStageDot } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ModuleGate } from '@/components/modules/ModuleGate'

type Period = 'month' | 'quarter' | 'year'
const PERIOD_LABELS: Record<Period, string> = { month: 'Mes', quarter: 'Trimestre', year: 'Año' }

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4',
  referido: '#10B981', zonaprop: '#FF6B00', argenprop: '#8B5CF6',
  mercadolibre: '#FFE600', cartel: '#F59E0B', telefono: '#6B7280',
  manual: '#94A3B8', otro: '#CBD5E1',
}

function Sparkline({ data, color = 'var(--color-primary)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 80, h = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, trendLabel, trend, sparkData, sparkColor }: {
  label: string; value: string; trendLabel?: string
  trend?: 'up' | 'down' | 'neutral'; sparkData?: number[]; sparkColor?: string
}) {
  return (
    <Card className="p-4 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-start justify-between">
        <Text size="xs" weight="medium" tone="muted" className="uppercase tracking-wide leading-tight">{label}</Text>
        {sparkData && sparkData.some(v => v > 0) && <Sparkline data={sparkData} color={sparkColor} />}
      </div>
      <div>
        <Heading level={2} as="p" weight="bold" className="mt-1">{value}</Heading>
        {trendLabel && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-success" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-danger" />}
            <span className={`text-xs font-medium ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-gray-400'}`}>
              {trendLabel}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

// Chip de estado de una integración. Se decidió NO promoverlo al DS: 1 solo uso
// en toda la app (ver la tanda de decisiones en doc/ds-review.md). Si aparecen
// más integraciones y el patrón se repite, ahí sí va a ui/.
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

interface CampaignRow {
  campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  account_currency: string | null
  crm_leads: number
  crm_calificados: number
  crm_captados: number
  cpl: number | null
}

interface CampaignsResponse {
  status: 'ok' | 'not_configured' | 'missing_ad_account' | 'token_error' | 'api_error'
  error: string | null
  campaigns: CampaignRow[]
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

function MarketingPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [campaignsData, setCampaignsData] = useState<CampaignsResponse | null>(null)

  useEffect(() => {
    setLoading(true)
    apiFetch('analytics', `/marketing?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  useEffect(() => {
    setCampaignsData(null)
    apiFetch('analytics', `/marketing/campaigns?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => setCampaignsData(d))
      .catch(() => setCampaignsData({ status: 'api_error', error: 'No se pudieron cargar las campañas', campaigns: [] }))
  }, [period])

  const totalLeads: number = data?.totalLeads ?? 0
  const conversionRate: number = data?.conversionRate ?? 0
  const leadsBySource: { source: string; count: number }[] = data?.leadsBySource ?? []
  const leadsByDay: { day: string; count: number }[] = data?.leadsByDay ?? []
  const metaEvents: Record<string, { sent: number; failed: number }> = data?.metaEvents ?? {}
  const integration = data?.integration ?? { meta: { enabled: false, pixelId: null }, ga4: { enabled: false, measurementId: null } }
  const funnel: { stage: string; count: number; rate: number }[] = data?.funnel ?? []

  const maxSource = leadsBySource[0]?.count ?? 1
  const captados = funnel.find(f => f.stage === 'captado')?.count ?? 0
  const calificados = funnel.find(f => f.stage === 'calificado')?.count ?? 0
  const contactados = funnel.find(f => f.stage === 'contactado')?.count ?? 0
  // Color de cada paso = dot de su etapa del pipeline (fuente única en crm-config),
  // así el funnel de marketing usa los mismos tonos que los badges de esas etapas.
  const funnelSteps = [
    { label: 'Leads capturados', count: totalLeads, color: getStageDot('nuevo') },
    { label: 'Contactados', count: contactados, color: getStageDot('contactado') },
    { label: 'Calificados', count: calificados, color: getStageDot('calificado') },
    { label: 'En tasación', count: funnel.find(f => f.stage === 'en_tasacion')?.count ?? 0, color: getStageDot('en_tasacion') },
    { label: 'Captados', count: captados, color: getStageDot('captado') },
  ]
  const maxFunnel = funnelSteps[0]?.count || 1
  const metaEventList = Object.entries(metaEvents).map(([name, v]) => ({ name, sent: v.sent, failed: v.failed, total: v.sent + v.failed })).sort((a, b) => b.total - a.total)
  const sparkData = leadsByDay.map(d => d.count)
  const totalEventsToMeta = metaEventList.reduce((a, e) => a + e.sent, 0)

  const insights = [
    totalLeads > 0 && leadsBySource[0]
      ? { icon: TrendingUp, text: `${LEAD_SOURCES[leadsBySource[0].source as keyof typeof LEAD_SOURCES]?.label ?? leadsBySource[0].source} es tu principal fuente con ${leadsBySource[0].count} leads este período.` }
      : null,
    conversionRate > 0
      ? { icon: Target, text: `Tasa de conversión lead → captado: ${conversionRate.toFixed(1)}%. ${conversionRate >= 10 ? 'Por encima del promedio del sector (8%).' : 'Hay margen para mejorar el seguimiento.'}` }
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

      {/* Header */}
      <PageHeader
        title="Marketing"
        subtitle="Atribución de leads, eventos y conversiones"
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

      {/* Integration status — Meta + GA4 */}
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
          {[...Array(4)].map((_, i) => <div key={i} className="h-[100px] bg-gray-100 rounded-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Leads del período" value={String(totalLeads)}
            trendLabel={totalLeads > 0 ? `${captados} captados` : 'Sin leads aún'}
            trend={totalLeads > 0 ? 'up' : 'neutral'} sparkData={sparkData} sparkColor="#818CF8" />
          <KpiCard label="Tasa de conversión" value={`${conversionRate.toFixed(1)}%`}
            trendLabel="lead → captado"
            trend={conversionRate >= 10 ? 'up' : conversionRate > 0 ? 'neutral' : 'down'}
            sparkData={sparkData.map((_, i, a) => i > 0 ? Math.max(0, a[i] - a[i - 1]) : 0)} sparkColor="#10B981" />
          <KpiCard label="Eventos a Meta" value={String(totalEventsToMeta)}
            trendLabel={integration.meta.enabled ? `${metaEventList.length} tipos de evento` : 'API no conectada'}
            trend={integration.meta.enabled && totalEventsToMeta > 0 ? 'up' : 'neutral'} />
          <KpiCard label="Fuentes activas" value={String(leadsBySource.length)}
            trendLabel={leadsBySource[0] ? `${LEAD_SOURCES[leadsBySource[0].source as keyof typeof LEAD_SOURCES]?.label ?? leadsBySource[0].source} lidera` : 'Sin datos'}
            trend="neutral" />
        </div>
      )}

      {/* Funnel + Leads por fuente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><Target className="w-4 h-4 text-gray-600" /> Embudo del período</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">De lead capturado a captación</Text>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : totalLeads === 0 ? <Text tone="muted" className="text-center py-8">Sin leads en este período</Text>
            : (
              <div className="space-y-3">
                {funnelSteps.map(step => {
                  const pct = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0
                  return (
                    <div key={step.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600">{step.label}</span>
                        <span className="text-xs font-semibold text-gray-700">{step.count}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </Card>

        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-gray-600" /> Leads por fuente</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">Atribución del período</Text>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : leadsBySource.length === 0 ? <Text tone="muted" className="text-center py-8">Sin datos de fuente</Text>
            : (
              <div className="space-y-3">
                {leadsBySource.slice(0, 7).map(({ source, count }) => {
                  const label = LEAD_SOURCES[source as keyof typeof LEAD_SOURCES]?.label ?? source
                  const color = SOURCE_COLORS[source] ?? '#CBD5E1'
                  const total = leadsBySource.reduce((a, s) => a + s.count, 0)
                  return (
                    <div key={source}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />{label}
                        </span>
                        <span className="text-xs text-gray-500">{count} · {total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxSource) * 100}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </Card>
      </div>

      {/* Campañas activas */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <Heading level={4} className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#1877F2]" /> Campañas activas</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">Performance por campaña con atribución completa</Text>
          </div>
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#1877F2] font-medium hover:underline">
            Abrir Meta Ads <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {campaignsData === null ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : campaignsData.status === 'not_configured' ? (
          <EmptyState
            icon={<Megaphone className="w-6 h-6" />}
            title="Conectá Meta Conversion API para ver campañas"
            description="Gasto, leads, calificados, CPL y ROI por campaña"
            action={
              <Link href="/configuracion/marketing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
                <Settings className="w-4 h-4" /> Configurar ahora
              </Link>
            }
          />
        ) : campaignsData.status === 'missing_ad_account' ? (
          <Alert tone="info" title="Todo listo — falta el Ad Account ID">
            <p>
              Cargá tu Ad Account (act_…) en Ajustes → Marketing y asegurate de que el token tenga permiso <code>ads_read</code>.
              Las campañas aparecen solas al guardarlo.
            </p>
            <Link href="/configuracion/marketing"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
              <Settings className="w-4 h-4" /> Completar configuración
            </Link>
          </Alert>
        ) : campaignsData.status !== 'ok' ? (
          <Alert tone="danger" title="No se pudieron leer las campañas de Meta">
            <p>
              {campaignsData.status === 'token_error'
                ? 'El token guardado no es válido — volvé a cargarlo en Ajustes → Marketing.'
                : campaignsData.error ?? 'Error desconocido.'}
            </p>
            <p className="mt-1">
              Si el error menciona permisos, el token necesita <code>ads_read</code> sobre el ad account (se agrega en Meta Business → System Users).
            </p>
          </Alert>
        ) : campaignsData.campaigns.length === 0 ? (
          <Text tone="muted" className="text-center py-8">Sin campañas con actividad en este período</Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-2 pr-3">Campaña</th>
                  <th className="text-right font-medium py-2 px-3">Gasto</th>
                  <th className="text-right font-medium py-2 px-3">Impresiones</th>
                  <th className="text-right font-medium py-2 px-3">Clicks</th>
                  <th className="text-right font-medium py-2 px-3">Leads Meta</th>
                  <th className="text-right font-medium py-2 px-3">Leads CRM</th>
                  <th className="text-right font-medium py-2 px-3">Calificados</th>
                  <th className="text-right font-medium py-2 px-3">Captados</th>
                  <th className="text-right font-medium py-2 pl-3">CPL</th>
                </tr>
              </thead>
              <tbody>
                {campaignsData.campaigns.map(cp => (
                  <tr key={cp.campaign_id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-gray-700 max-w-[220px] truncate" title={cp.campaign_name}>{cp.campaign_name}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{fmtMoney(cp.spend, cp.account_currency)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{cp.impressions.toLocaleString('es-AR')}</td>
                    <td className="py-2.5 px-3 text-right text-gray-500">{cp.clicks.toLocaleString('es-AR')}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{cp.leads}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{cp.crm_leads}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{cp.crm_calificados}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-success">{cp.crm_captados}</td>
                    <td className="py-2.5 pl-3 text-right font-semibold text-ink">{cp.cpl !== null ? fmtMoney(cp.cpl, cp.account_currency) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-2">
              Leads CRM atribuidos por nombre de campaña (source_detail de la landing). Datos de Meta cacheados 15 min.
            </p>
          </div>
        )}
      </Card>

      {/* Eventos Meta + Audiencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-[#1877F2]" /> Eventos enviados a Meta</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">Conversion API · stages del CRM</Text>
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

        <Card>
          <div className="mb-4">
            <Heading level={4} className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-600" /> Audiencias sugeridas</Heading>
            <Text size="xs" tone="muted" className="mt-0.5">Listas para exportar a Meta Ads Manager</Text>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Leads calidad alta sin cerrar', sub: 'Retargeting WhatsApp', color: 'bg-orange-50 border-orange-200', count: calificados },
              { label: 'Visitantes landing sin lead', sub: 'Retargeting landing', color: 'bg-purple-50 border-purple-200', count: null },
              { label: 'Propietarios captados', sub: 'Lookalike captaciones', color: 'bg-green-50 border-green-200', count: captados },
              { label: 'Referidos potenciales', sub: 'Leads por referido', color: 'bg-blue-50 border-blue-200', count: leadsBySource.find(s => s.source === 'referido')?.count ?? 0 },
            ].map(a => (
              <div key={a.label} className={`flex items-center justify-between px-3 py-2.5 rounded-control border ${a.color}`}>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.count !== null && <span className="text-sm font-bold text-gray-600">{a.count}</span>}
                  <Button variant="outline">Exportar →</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
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
