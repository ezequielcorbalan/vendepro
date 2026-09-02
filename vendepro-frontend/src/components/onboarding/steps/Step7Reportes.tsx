import { BarChart3, TrendingUp, FileBarChart, Target } from 'lucide-react'
import { StatTile } from '@/components/ui/StatTile'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step7Reportes() {
  return (
    <StepLayout
      icon={<BarChart3 className="w-7 h-7" />}
      title="Reportes y dashboard"
      subtitle="Tomá decisiones basadas en datos. El dashboard te da una visión ejecutiva del negocio en tiempo real."
    >
      {/* KPIs de muestra. Los tonos son los semánticos del DS, no colores sueltos. */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        <StatTile value="24" label="Leads activos" tone="info" />
        <StatTile value="8" label="Tasaciones" tone="primary" />
        <StatTile value="18%" label="Conversión" tone="success" />
      </div>

      <StepBullets
        items={[
          [<BarChart3 key="a" className="w-4 h-4" />, 'Funnel de conversión Lead → Captación con métricas por etapa'],
          [<TrendingUp key="b" className="w-4 h-4" />, 'Actividad semanal y comparativa de rendimiento por agente'],
          [<FileBarChart key="c" className="w-4 h-4" />, 'Reportes PDF para propietarios con tu branding y datos de mercado'],
          [<Target key="d" className="w-4 h-4" />, 'Mi Performance: métricas individuales y seguimiento de objetivos'],
        ]}
      />
    </StepLayout>
  )
}
