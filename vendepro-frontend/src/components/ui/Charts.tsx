'use client'

import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_PALETTE } from '@/lib/crm-config'

/**
 * Gráficos del design system (Recharts). Color de datos primario = brand-pink
 * (vía token). Para series múltiples usa CHART_PALETTE de crm-config. El embudo
 * es SVG/divs propio con el gradiente de marca.
 */
const AXIS_TICK = { fontSize: 11, fill: '#9ca3af' }
const GRID = '#f3f4f6'

interface BarDatum { label: string; value: number }

export function BarChart({ data, height = 200, className }: { data: BarDatum[]; height?: number; className?: string }) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={32} />
          <RTooltip cursor={{ fill: 'rgba(255,0,124,0.05)' }} />
          <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface DonutDatum { name: string; value: number }

export function DonutChart({
  data,
  height = 180,
  colors = CHART_PALETTE,
  className,
}: {
  data: DonutDatum[]
  height?: number
  colors?: readonly string[]
  className?: string
}) {
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <RTooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface FunnelStep { label: string; value: number }

export function Funnel({ steps, className }: { steps: FunnelStep[]; className?: string }) {
  const max = Math.max(...steps.map(s => s.value), 1)
  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      {steps.map((s, i) => {
        // Interpola el color rosa→naranja según la posición en el embudo.
        const t = steps.length > 1 ? i / (steps.length - 1) : 0
        return (
          <div
            key={s.label}
            className="flex items-center justify-between text-white rounded-control px-3 py-2 text-xs font-medium"
            style={{
              width: `${Math.max(20, (s.value / max) * 100)}%`,
              background: `color-mix(in oklab, var(--color-brand-pink) ${Math.round((1 - t) * 100)}%, var(--color-brand-orange))`,
            }}
          >
            <span>{s.label}</span>
            <b>{s.value}</b>
          </div>
        )
      })}
    </div>
  )
}
