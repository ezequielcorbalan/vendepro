import { BarChart3, PieChart, TrendingUp, FileText, Trophy } from 'lucide-react'
import { StatTile } from '@/components/ui/StatTile'
import { Heading, Text } from '@/components/ui/Typography'

const KPIS = [
  { label: 'Leads activos', value: '24', tone: 'bg-info/10 text-info' },
  { label: 'Tasaciones', value: '8', tone: 'bg-purple/10 text-purple' },
  { label: 'Conversión', value: '18%', tone: 'bg-primary/10 text-primary' },
]

const FEATURES = [
  [PieChart, 'Funnel de conversión Lead → Captación con métricas por etapa'],
  [TrendingUp, 'Actividad semanal y comparativa de rendimiento por agente'],
  [FileText, 'Reportes PDF para propietarios con tu branding y datos de mercado'],
  [Trophy, 'Mi Performance: métricas individuales y seguimiento de objetivos'],
] as const

export default function Step7Reportes() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-warning/10 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-warning" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>Reportes y dashboard</Heading>
        <Text tone="muted" className="max-w-sm">
          Tomá decisiones basadas en datos. El dashboard te da una visión ejecutiva del negocio en tiempo real.
        </Text>
      </div>

      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {KPIS.map(kpi => (
          <StatTile key={kpi.label} value={kpi.value} label={kpi.label} tone={kpi.tone} />
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {FEATURES.map(([Icon, text]) => (
          <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-card">
            <Icon className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" aria-hidden="true" />
            <Text size="sm" className="text-gray-700">{text}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}
