import { RefreshCw, Pin, AlertTriangle, Filter, ArrowRight, ArrowDown } from 'lucide-react'
import { StepLayout } from './StepLayout'

// Las seis entidades del ciclo comercial. No son LEAD_STAGES ni PROPERTY_STAGES
// (son entidades, no estados), así que el color sale de la paleta genérica del
// DS por token, no de clases Tailwind sueltas.
const stages = [
  { label: 'Lead', tone: 'bg-blue/10 text-blue' },
  { label: 'Contacto', tone: 'bg-cyan/10 text-cyan' },
  { label: 'Tasación', tone: 'bg-purple/10 text-purple' },
  { label: 'Propiedad', tone: 'bg-green/10 text-green' },
  { label: 'Reserva', tone: 'bg-orange/10 text-orange' },
  { label: 'Venta', tone: 'bg-primary/10 text-primary' },
]

export default function Step2Pipeline() {
  return (
    <StepLayout
      icon={<RefreshCw className="w-8 h-8" />}
      title="El pipeline comercial"
      description="Todo el ciclo de vida de una operación, desde el primer lead hasta el cierre."
      points={[
        { icon: <Pin className="w-4 h-4" />, text: 'Cada etapa tiene sus acciones y seguimientos definidos' },
        { icon: <AlertTriangle className="w-4 h-4" />, text: 'El sistema te avisa cuando un lead está vencido o sin actividad' },
        { icon: <Filter className="w-4 h-4" />, text: 'Filtrá por etapa desde leads, tasaciones o propiedades' },
      ]}
    >
      <div className="w-full max-w-md">
        {/* Escritorio: horizontal */}
        <div className="hidden sm:flex items-center justify-center flex-wrap gap-1">
          {stages.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1">
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.tone}`}>
                {s.label}
              </span>
              {i < stages.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
        {/* Mobile: vertical */}
        <div className="sm:hidden flex flex-col items-center gap-1">
          {stages.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className={`px-4 py-1.5 rounded-full text-xs font-medium ${s.tone}`}>
                {s.label}
              </span>
              {i < stages.length - 1 && (
                <ArrowDown className="w-3.5 h-3.5 text-gray-300" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </div>
    </StepLayout>
  )
}
