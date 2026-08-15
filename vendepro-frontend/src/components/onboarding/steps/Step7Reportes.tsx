import { BarChart3 } from 'lucide-react'
import { StatTile } from '@/components/ui/StatTile'

export default function Step7Reportes() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-amber-100 flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-amber-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-ink">Reportes y dashboard</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Tomá decisiones basadas en datos. El dashboard te da una visión ejecutiva del negocio en tiempo real.
        </p>
      </div>

      {/* Mini KPI preview */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {[
          { label: 'Leads activos', value: '24', color: 'bg-blue-50 text-blue-700' },
          { label: 'Tasaciones', value: '8', color: 'bg-purple-50 text-purple-700' },
          { label: 'Conversión', value: '18%', color: 'bg-pink-50 text-pink-700' },
        ].map(kpi => (
          <StatTile key={kpi.label} value={kpi.value} label={kpi.label} tone={kpi.color} />
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📊', 'Funnel de conversión Lead → Captación con métricas por etapa'],
          ['📈', 'Actividad semanal y comparativa de rendimiento por agente'],
          ['📑', 'Reportes PDF para propietarios con tu branding y datos de mercado'],
          ['🏆', 'Mi Performance: métricas individuales y seguimiento de objetivos'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-card">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <p className="text-sm text-gray-700">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
