import { BarChart3, Filter, TrendingUp, FileText, Trophy } from 'lucide-react'
import { StatTile } from '@/components/ui/StatTile'
import { StepLayout } from './StepLayout'

// StatTile sin ícono tiñe toda la tile con el `tone`: acá van los tokens
// semánticos del DS, no clases Tailwind sueltas.
const kpis = [
  { label: 'Leads activos', value: '24', tone: 'info' },
  { label: 'Tasaciones', value: '8', tone: 'primary' },
  { label: 'Conversión', value: '18%', tone: 'success' },
]

export default function Step7Reportes() {
  return (
    <StepLayout
      icon={<BarChart3 className="w-8 h-8" />}
      iconClassName="bg-warning/10 text-warning"
      title="Reportes y dashboard"
      description="Tomá decisiones basadas en datos. El dashboard te da una visión ejecutiva del negocio en tiempo real."
      points={[
        { icon: <Filter className="w-4 h-4" />, text: 'Funnel de conversión Lead → Captación con métricas por etapa' },
        { icon: <TrendingUp className="w-4 h-4" />, text: 'Actividad semanal y comparativa de rendimiento por agente' },
        { icon: <FileText className="w-4 h-4" />, text: 'Reportes PDF para propietarios con tu branding y datos de mercado' },
        { icon: <Trophy className="w-4 h-4" />, text: 'Mi Performance: métricas individuales y seguimiento de objetivos' },
      ]}
    >
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {kpis.map(kpi => (
          <StatTile key={kpi.label} value={kpi.value} label={kpi.label} tone={kpi.tone} />
        ))}
      </div>
    </StepLayout>
  )
}
