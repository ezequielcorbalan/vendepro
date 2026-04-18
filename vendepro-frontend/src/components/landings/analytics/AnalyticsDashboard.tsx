'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { landingsApi } from '@/lib/landings/api'
import type { AnalyticsSummary } from '@/lib/landings/types'

function KPI({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

function FunnelRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_70px] items-center py-2 border-b border-gray-100 last:border-b-0 text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mx-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="text-right text-gray-900 font-medium">{count.toLocaleString('es-AR')}</span>
    </div>
  )
}

export default function AnalyticsDashboard({ landingId }: { landingId: string }) {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [range, setRange] = useState<7 | 14 | 30>(7)

  useEffect(() => {
    setData(null)
    landingsApi.analytics(landingId, range).then(r => setData(r.summary)).catch(() => setData(null))
  }, [landingId, range])

  if (!data) return <div className="p-8 text-center text-gray-500">Cargando métricas…</div>

  const pct = (n: number) => data.pageviews > 0 ? (n / data.pageviews) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([7, 14, 30] as const).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`text-xs px-3 py-1.5 rounded-full ${range === r ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-700'}`}>
            Últimos {r} días
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pageviews" value={data.pageviews.toLocaleString('es-AR')} />
        <KPI label="Unique visitors" value={data.unique_visitors.toLocaleString('es-AR')} />
        <KPI label="Form submits" value={data.form_submits.toLocaleString('es-AR')} />
        <KPI label="Conversion rate" value={`${(data.conversion_rate * 100).toFixed(1)}%`} hint="submits / pageviews" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Pageviews por día</h4>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={data.pageviews_by_day}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ff007c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Funnel</h4>
          <FunnelRow label="Pageviews" count={data.pageviews} pct={100} />
          <FunnelRow label="CTA clicks" count={data.cta_clicks} pct={pct(data.cta_clicks)} />
          <FunnelRow label="Form start" count={data.form_starts} pct={pct(data.form_starts)} />
          <FunnelRow label="Submit" count={data.form_submits} pct={pct(data.form_submits)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Top UTM sources</h4>
        <div className="space-y-1.5">
          {data.top_utm_sources.length === 0 && <p className="text-sm text-gray-500">Sin datos.</p>}
          {data.top_utm_sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{s.source}</span>
              <span className="text-gray-900 font-medium">{s.count.toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
