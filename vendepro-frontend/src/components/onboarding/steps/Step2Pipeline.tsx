import { RefreshCw, Pin, AlertTriangle, Filter } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

// Etapas conceptuales del ciclo comercial (entidades, no stages de una entidad):
// no hay mapa de dominio en crm-config para esta secuencia, así que el color
// sale de la paleta genérica del DS.
const STAGES = [
  { label: 'Lead', color: 'bg-blue/10 text-blue' },
  { label: 'Contacto', color: 'bg-cyan/10 text-cyan' },
  { label: 'Tasación', color: 'bg-purple/10 text-purple' },
  { label: 'Propiedad', color: 'bg-green/10 text-green' },
  { label: 'Reserva', color: 'bg-orange/10 text-orange' },
  { label: 'Venta', color: 'bg-primary/10 text-primary' },
]

const FEATURES = [
  [Pin, 'Cada etapa tiene sus acciones y seguimientos definidos'],
  [AlertTriangle, 'El sistema te avisa cuando un lead está vencido o sin actividad'],
  [Filter, 'Filtrá por etapa desde leads, tasaciones o propiedades'],
] as const

export default function Step2Pipeline() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-md shadow-primary/20">
        <RefreshCw className="w-8 h-8 text-white" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>El pipeline comercial</Heading>
        <Text tone="muted" className="max-w-sm">
          Todo el ciclo de vida de una operación, desde el primer lead hasta el cierre.
        </Text>
      </div>

      {/* Pipeline visual */}
      <div className="w-full max-w-md">
        {/* Desktop: horizontal */}
        <div className="hidden sm:flex items-center justify-center flex-wrap gap-1">
          {STAGES.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1">
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className="text-gray-300 text-sm">→</span>}
            </div>
          ))}
        </div>
        {/* Mobile: vertical */}
        <div className="sm:hidden flex flex-col items-center gap-1">
          {STAGES.map((s, i) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className={`px-4 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
                {s.label}
              </span>
              {i < STAGES.length - 1 && <span className="text-gray-300 text-xs">↓</span>}
            </div>
          ))}
        </div>
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
