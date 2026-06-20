'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, TrendingUp, TrendingDown, Users, Target,
  CheckCircle2, XCircle, AlertCircle, ChevronRight, Sparkles,
  BarChart2, ArrowUpRight, ExternalLink,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_SOURCES } from '@/lib/crm-config'

type Period = 'month' | 'quarter' | 'year'
const PERIOD_LABELS: Record<Period, string> = { month: 'Mes', quarter: 'Trimestre', year: 'Año' }

const SOURCE_COLORS: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#4285F4',
  referido: '#10B981', zonaprop: '#FF6B00', argenprop: '#8B5CF6',
  mercadolibre: '#FFE600', cartel: '#F59E0B', telefono: '#6B7280',
  manual: '#94A3B8', otro: '#CBD5E1',
}

function Sparkline({ data, color = '#ff007c' }: { data: number[]; color?: string }) {
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
    <div className="bg-white rounded-xl border p-4 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-start justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium leading-tight">{label}</p>
        {sparkData && sparkData.some(v => v > 0) && <Sparkline data={sparkData} color={sparkColor ?? '#ff007c'} />}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        {trendLabel && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
            <span className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
              {trendLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrationBadge({ name, enabled, detail }: { name: string; enabled: boolean; detail?: string }) {
  return (
    <div className={`flex items-center gap-2.5 flex-1 px-3 py-2.5 rounded-lg border ${enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
      {enabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-gray-500'}`}>{name}</p>
        {detail && <p className="text-[10px] text-gray-400 truncate">{detail}</p>}
      </div>
    </div>
  )
}

export default function MarketingPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiFetch('analytics', `/marketing?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
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
  const funnelSteps = [
    { label: 'Leads capturados', count: totalLeads, color: '#818CF8' },
    { label: 'Contactados', count: contactados, color: '#C084FC' },
    { label: 'Calificados', count: calificados, color: '#F472B6' },
    { label: 'En tasación', count: funnel.find(f => f.stage === 'en_tasacion')?.count ?? 0, color: '#fb923c' },
    { label: 'Captados', count: captados, color: '#10B981' },
  ]
  const maxFunnel = funnelSteps[0]?.count || 1
  const metaEventList = Object.entries(metaEvents).map(([name, v]) => ({ name, sent: v.sent, failed: v.failed, total: v.sent + v.failed })).sort((a, b) => b.total - a.total)
  const sparkData = leadsByDay.map(d => d.count)
  const totalEventsToMeta = metaEventList.reduce((a, e) => a + e.sent, 0)

  const insights = [
    totalLeads > 0 && leadsBySource[0]
      ? { icon: '📈', text: `${LEAD_SOURCES[leadsBySource[0].source as keyof typeof LEAD_SOURCES]?.label ?? leadsBySource[0].source} es tu principal fuente con ${leadsBySource[0].count} leads este período.` }
      : null,
    conversionRate > 0
      ? { icon: '🎯', text: `Tasa de conversión lead → captado: ${conversionRate.toFixed(1)}%. ${conversionRate >= 10 ? 'Por encima del promedio del sector (8%).' : 'Hay margen para mejorar el seguimiento.'}` }
      : null,
    Object.values(metaEvents).some(e => e.failed > 0)
      ? { icon: '⚠️', text: 'Hay eventos fallidos en Meta Conversion API. Verificá la configuración en Ajustes → Marketing.' }
      : integration.meta.enabled
      ? { icon: '✅', text: `Meta Conversion API activa. ${totalEventsToMeta} eventos enviados este período.` }
      : { icon: '💡', text: 'Conectá Meta Conversion API para trackear conversiones server-side y mejorar audiencias.' },
    !integration.ga4.enabled
      ? { icon: '📊', text: 'GA4 no configurado. Activalo en Ajustes → Marketing para medir tráfico orgánico.' }
      : null,
  ].filter(Boolean) as { icon: string; text: string }[]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Marketing</h1>
            <p className="text-sm text-gray-400">Atribución de leads, eventos y conversiones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <Link href="/configuracion/marketing"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Configurar
          </Link>
        </div>
      </div>

      {/* Integration status — Meta + GA4 */}
      {!loading && (
        <div className="flex flex-col sm:flex-row gap-2">
          <IntegrationBadge name="Meta Conversion API" enabled={integration.meta.enabled}
            detail={integration.meta.enabled ? `Pixel: ${integration.meta.pixelId} · ${totalEventsToMeta} eventos` : 'No configurada — conectá tu Pixel'} />
          <IntegrationBadge name="Google Analytics 4" enabled={integration.ga4.enabled}
            detail={integration.ga4.enabled ? `Measurement ID: ${integration.ga4.measurementId}` : 'No configurado — activá GA4'} />
          {(!integration.meta.enabled || !integration.ga4.enabled) && (
            <Link href="/configuracion/marketing"
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed text-xs font-medium text-brand-pink border-brand-pink/30 hover:bg-pink-50 transition-colors whitespace-nowrap">
              <ChevronRight className="w-3.5 h-3.5" /> Completar config
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-[100px] bg-gray-100 rounded-xl animate-pulse" />)}
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
        <div className="bg-white rounded-xl border p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Target className="w-4 h-4 text-brand-pink" /> Embudo del período</p>
            <p className="text-xs text-gray-400 mt-0.5">De lead capturado a captación</p>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : totalLeads === 0 ? <p className="text-sm text-gray-400 text-center py-8">Sin leads en este período</p>
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
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-brand-pink" /> Leads por fuente</p>
            <p className="text-xs text-gray-400 mt-0.5">Atribución del período</p>
          </div>
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
            : leadsBySource.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">Sin datos de fuente</p>
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
        </div>
      </div>

      {/* Campañas activas */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#1877F2]" /> Campañas activas</p>
            <p className="text-xs text-gray-400 mt-0.5">Performance por campaña con atribución completa</p>
          </div>
          <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#1877F2] font-medium hover:underline">
            Abrir Meta Ads <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {integration.meta.enabled ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Integración con Meta Ads API próximamente</p>
            <p className="text-xs mt-1">Verás ROI, CPL y captaciones por campaña en tiempo real</p>
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-6 text-center">
            <p className="text-sm font-medium text-gray-600 mb-1">Conectá Meta Conversion API para ver campañas</p>
            <p className="text-xs text-gray-400 mb-3">Gasto, leads, calificados, CPL y ROI por campaña</p>
            <Link href="/configuracion/marketing"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-pink text-white text-xs font-medium hover:bg-[#e0006e] transition-colors">
              <Settings className="w-3.5 h-3.5" /> Configurar ahora
            </Link>
          </div>
        )}
      </div>

      {/* Eventos Meta + Audiencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-[#1877F2]" /> Eventos enviados a Meta</p>
            <p className="text-xs text-gray-400 mt-0.5">Conversion API · stages del CRM</p>
          </div>
          {!integration.meta.enabled ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-2">API no configurada</p>
              <Link href="/configuracion/marketing" className="text-xs text-brand-pink font-medium hover:underline">Configurar Meta →</Link>
            </div>
          ) : metaEventList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin eventos registrados aún</p>
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
                    {evt.failed > 0 ? <XCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Users className="w-4 h-4 text-brand-pink" /> Audiencias sugeridas</p>
            <p className="text-xs text-gray-400 mt-0.5">Listas para exportar a Meta Ads Manager</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Leads calidad alta sin cerrar', sub: 'Retargeting WhatsApp', color: 'bg-orange-50 border-orange-200', count: calificados },
              { label: 'Visitantes landing sin lead', sub: 'Retargeting landing', color: 'bg-purple-50 border-purple-200', count: null },
              { label: 'Propietarios captados', sub: 'Lookalike captaciones', color: 'bg-green-50 border-green-200', count: captados },
              { label: 'Referidos potenciales', sub: 'Leads por referido', color: 'bg-blue-50 border-blue-200', count: leadsBySource.find(s => s.source === 'referido')?.count ?? 0 },
            ].map(a => (
              <div key={a.label} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${a.color}`}>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{a.label}</p>
                  <p className="text-xs text-gray-400">{a.sub}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.count !== null && <span className="text-sm font-bold text-gray-600">{a.count}</span>}
                  <button className="text-[10px] text-brand-pink font-semibold border border-brand-pink/30 rounded-lg px-2 py-1 hover:bg-pink-50 transition-colors">
                    Exportar →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-r from-brand-pink/5 to-brand-orange/5 rounded-xl border border-brand-pink/20 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-pink" /> Insights del período
          </p>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="shrink-0">{ins.icon}</span><span>{ins.text}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
