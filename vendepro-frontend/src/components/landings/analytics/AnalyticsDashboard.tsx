'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { landingsApi } from '@/lib/landings/api'
import type { AnalyticsSummary } from '@/lib/landings/types'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/Button'

function FunnelRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="grid grid-cols-[110px_1fr_70px] items-center py-2 border-b border-gray-100 last:border-b-0 text-sm">
      <span className="text-gray-700">{label}</span>
      <div className="mx-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-pink to-brand-orange rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="text-right text-ink font-medium">{count.toLocaleString('es-AR')}</span>
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
          <Button variant="primary" size="sm" key={r} onClick={() => setRange(r)}
            className={`text-xs px-3 py-1.5 rounded-full ${range === r ? 'bg-brand-pink text-white' : 'bg-gray-100 text-gray-700'}`}>
            Últimos {r} días
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Pageviews" value={data.pageviews.toLocaleString('es-AR')} />
        <StatTile label="Unique visitors" value={data.unique_visitors.toLocaleString('es-AR')} />
        <StatTile label="Form submits" value={data.form_submits.toLocaleString('es-AR')} />
        <StatTile label="Conversion rate" value={`${(data.conversion_rate * 100).toFixed(1)}%`} caption="submits / pageviews" />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-card border border-gray-200 p-4">
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

        <div className="bg-white rounded-card border border-gray-200 p-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Funnel</h4>
          <FunnelRow label="Pageviews" count={data.pageviews} pct={100} />
          <FunnelRow label="CTA clicks" count={data.cta_clicks} pct={pct(data.cta_clicks)} />
          <FunnelRow label="Form start" count={data.form_starts} pct={pct(data.form_starts)} />
          <FunnelRow label="Submit" count={data.form_submits} pct={pct(data.form_submits)} />
        </div>
      </div>

      <div className="bg-white rounded-card border border-gray-200 p-4">
        <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Top UTM sources</h4>
        <div className="space-y-1.5">
          {data.top_utm_sources.length === 0 && <p className="text-sm text-gray-500">Sin datos.</p>}
          {data.top_utm_sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{s.source}</span>
              <span className="text-ink font-medium">{s.count.toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
