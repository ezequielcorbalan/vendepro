'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Eye, Home, Handshake, FileBarChart, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { apiFetch } from '@/lib/api'

type Period = 'week' | 'month' | 'quarter' | 'year'

interface PerformanceData {
  period: Period
  start: string
  end: string
  kpis: {
    reports_published: number
    total_impressions: number
    total_portal_visits: number
    total_in_person_visits: number
    total_offers: number
    avg_impressions_per_report: number
    avg_portal_visits_per_report: number
    avg_in_person_visits_per_report: number
    avg_offers_per_report: number
  }
  by_neighborhood: Array<{
    neighborhood: string
    reports_count: number
    avg_impressions: number
    avg_portal_visits: number
    avg_in_person_visits: number
    avg_offers: number
    total_offers: number
  }>
  timeline: Array<{
    period_label: string
    period_start: string
    impressions: number
    portal_visits: number
    in_person_visits: number
    offers: number
  }>
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function KPICard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    pink: 'bg-pink-50 text-pink-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <div className="bg-white rounded-xl border p-3 sm:p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorMap[color]}`} aria-hidden="true">
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>}
    </div>
  )
}

export default function PerformancePage() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<Period>('month')

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('analytics', `/listings-performance?period=${period}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [period])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Error al cargar los datos</p>
        <button
          onClick={() => setPeriod(p => p)}
          className="mt-3 text-sm text-red-600 underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const k = data.kpis
  const hasData = k.reports_published > 0

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {([
            ['week', 'Sem'],
            ['month', 'Mes'],
            ['quarter', 'Trim'],
            ['year', 'Año'],
          ] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                period === k ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {!hasData && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <FileBarChart className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-600 font-medium">Todavía no hay reportes publicados en este período</p>
          <p className="text-gray-500 text-sm mt-1">
            Probá un rango más amplio, o publicá el primer reporte desde una propiedad.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              icon={<FileBarChart className="w-5 h-5" />}
              label="Reportes publicados"
              value={String(k.reports_published)}
              color="pink"
            />
            <KPICard
              icon={<Eye className="w-5 h-5" />}
              label="Impresiones totales"
              value={formatNumber(k.total_impressions)}
              sublabel={`${k.avg_impressions_per_report} por aviso`}
              color="orange"
            />
            <KPICard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Visitas al portal"
              value={formatNumber(k.total_portal_visits)}
              sublabel={`${k.avg_portal_visits_per_report} por aviso`}
              color="blue"
            />
            <KPICard
              icon={<Handshake className="w-5 h-5" />}
              label="Ofertas recibidas"
              value={String(k.total_offers)}
              sublabel={`${k.avg_offers_per_report} por aviso`}
              color="green"
            />
          </div>

          <div className="bg-white rounded-xl border p-3 sm:p-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 mr-4">
              <Home className="w-3 h-3" aria-hidden="true" />
              Visitas presenciales totales:{' '}
              <strong className="text-gray-700">{k.total_in_person_visits}</strong>
              <span className="text-gray-400">({k.avg_in_person_visits_per_report} por aviso)</span>
            </span>
          </div>

          {/* Ranking de barrios */}
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
              Ranking por barrio
            </h2>
            {data.by_neighborhood.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos por barrio en este período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Barrio</th>
                      <th className="pb-2 px-2 text-right">Reportes</th>
                      <th className="pb-2 px-2 text-right">∅ Impresiones</th>
                      <th className="pb-2 px-2 text-right hidden sm:table-cell">∅ Visitas portal</th>
                      <th className="pb-2 px-2 text-right hidden md:table-cell">∅ Vis. presenciales</th>
                      <th className="pb-2 pl-2 text-right">Ofertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.by_neighborhood.map(n => (
                      <tr key={n.neighborhood} className="hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">{n.neighborhood}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{n.reports_count}</td>
                        <td className="py-2 px-2 text-right text-gray-700">{n.avg_impressions}</td>
                        <td className="py-2 px-2 text-right text-gray-700 hidden sm:table-cell">{n.avg_portal_visits}</td>
                        <td className="py-2 px-2 text-right text-gray-700 hidden md:table-cell">{n.avg_in_person_visits}</td>
                        <td className="py-2 pl-2 text-right font-semibold text-[#ff007c]">{n.total_offers}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Evolución temporal */}
          <div className="bg-white rounded-xl border p-4 sm:p-5">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#ff007c]" aria-hidden="true" />
              Evolución temporal
            </h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin datos de evolución en este período</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeline} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="period_label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="impressions" name="Impresiones" stroke="#ff8017" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="portal_visits" name="Visitas portal" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="in_person_visits" name="Visitas presenciales" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="offers" name="Ofertas" stroke="#ff007c" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
