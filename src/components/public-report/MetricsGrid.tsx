'use client'

import { Eye, MessageCircle, Phone, Users, Award, TrendingUp, MousePointerClick } from 'lucide-react'
import type { MetricTotals, MetricItemData } from '@/lib/metrics'
import { buildMetricItemsData } from '@/lib/metrics'

const iconMap: Record<string, React.ReactNode> = {
  Eye: <Eye className="w-5 h-5" />,
  MousePointerClick: <MousePointerClick className="w-5 h-5" />,
  MessageCircle: <MessageCircle className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Phone: <Phone className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
}

export { type MetricTotals }

export function MetricsGridFromTotals({ totals }: { totals: MetricTotals }) {
  const items = buildMetricItemsData(totals)
  return <MetricsGridDisplay items={items} />
}

export default function MetricsGridDisplay({ items }: { items: MetricItemData[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((m, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm"
        >
          <div
            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
            style={{ backgroundColor: m.color + '15' }}
          >
            <span style={{ color: m.color }}>{iconMap[m.iconName] || null}</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{m.value}</p>
          <p className="text-xs text-gray-500 mt-1">{m.label}</p>
        </div>
      ))}
    </div>
  )
}
