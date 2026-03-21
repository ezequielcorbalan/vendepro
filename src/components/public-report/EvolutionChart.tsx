'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { HistoricalDataPoint } from '@/lib/types'

export default function EvolutionChart({ data }: { data: HistoricalDataPoint[] }) {
  if (data.length === 0) return null

  return (
    <div className="w-full h-52 sm:h-64 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip />
          <Legend />
          <Bar dataKey="portal_visits" name="Visitas portal" fill="#ff007c" radius={[4, 4, 0, 0]} />
          <Bar dataKey="inquiries" name="Consultas" fill="#ff8017" radius={[4, 4, 0, 0]} />
          <Bar dataKey="in_person_visits" name="Visitas presenciales" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
