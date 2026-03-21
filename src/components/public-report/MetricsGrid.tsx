'use client'

import { Eye, MessageCircle, Phone, Users, Award, TrendingUp, MousePointerClick } from 'lucide-react'

interface MetricItem {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
}

export interface MetricTotals {
  impressions: number
  portal_visits: number
  inquiries: number
  phone_calls?: number
  whatsapp?: number
  in_person_visits: number
  offers: number
  ranking_position?: number | null
}

export function MetricsGridFromTotals({ totals }: { totals: MetricTotals }) {
  const metrics = buildMetricItems(totals)
  return <MetricsGrid metrics={metrics} />
}

export default function MetricsGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm"
        >
          <div
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: m.color + '15' }}
          >
            <span style={{ color: m.color }}>{m.icon}</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{m.value}</p>
          <p className="text-xs text-gray-500 mt-1">{m.label}</p>
        </div>
      ))}
    </div>
  )
}

export function buildMetricItems(totals: {
  impressions: number
  portal_visits: number
  inquiries: number
  phone_calls?: number
  whatsapp?: number
  in_person_visits: number
  offers: number
  ranking_position?: number | null
}): MetricItem[] {
  const items: MetricItem[] = [
    { label: 'Impresiones', value: totals.impressions.toLocaleString('es-AR'), icon: <Eye className="w-5 h-5" />, color: '#6366f1' },
    { label: 'Visitas al aviso', value: totals.portal_visits.toLocaleString('es-AR'), icon: <MousePointerClick className="w-5 h-5" />, color: '#ff007c' },
    { label: 'Consultas', value: totals.inquiries, icon: <MessageCircle className="w-5 h-5" />, color: '#ff8017' },
    { label: 'Visitas presenciales', value: totals.in_person_visits, icon: <Users className="w-5 h-5" />, color: '#10b981' },
  ]

  if (totals.phone_calls) {
    items.push({ label: 'Llamadas', value: totals.phone_calls, icon: <Phone className="w-5 h-5" />, color: '#8b5cf6' })
  }
  if (totals.whatsapp) {
    items.push({ label: 'WhatsApp', value: totals.whatsapp, icon: <MessageCircle className="w-5 h-5" />, color: '#22c55e' })
  }
  if (totals.offers) {
    items.push({ label: 'Ofertas', value: totals.offers, icon: <TrendingUp className="w-5 h-5" />, color: '#f59e0b' })
  }
  if (totals.ranking_position) {
    items.push({ label: 'Ranking zona', value: `#${totals.ranking_position}`, icon: <Award className="w-5 h-5" />, color: '#ef4444' })
  }

  return items
}
