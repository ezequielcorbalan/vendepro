'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { ReportMetric } from '@/lib/types'

const PORTAL_COLORS: Record<string, string> = {
  zonaprop: '#ff007c',
  argenprop: '#4f46e5',
  mercadolibre: '#f59e0b',
  manual: '#6b7280',
}

const PORTAL_NAMES: Record<string, string> = {
  zonaprop: 'ZonaProp',
  argenprop: 'Argenprop',
  mercadolibre: 'MercadoLibre',
  manual: 'Otros',
}

export default function PortalPieChart({
  metrics,
  dataKey,
  title,
}: {
  metrics: ReportMetric[]
  dataKey: 'inquiries' | 'portal_visits' | 'impressions'
  title: string
}) {
  const data = metrics
    .filter((m) => (m[dataKey] || 0) > 0)
    .map((m) => ({
      name: PORTAL_NAMES[m.source] || m.source,
      value: m[dataKey] || 0,
      color: PORTAL_COLORS[m.source] || '#6b7280',
    }))

  if (data.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">{title}</h3>
      <div className="h-40 sm:h-48 md:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${value}`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
