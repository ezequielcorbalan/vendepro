import { Building2, Camera, Globe, Eye, Briefcase } from 'lucide-react'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { Heading, Text } from '@/components/ui/Typography'

// Etapas reales de la propiedad: el badge toma el color de PROPERTY_STAGES,
// así el onboarding muestra los mismos colores que el pipeline de la app.
const STAGES = ['captada', 'publicada', 'reservada', 'vendida']

const FEATURES = [
  [Camera, 'Cargá fotos, fichas técnicas y documentación requerida'],
  [Globe, 'Creá landing pages personalizadas para cada propiedad con un clic'],
  [Eye, 'Registrá visitas de compradores y vinculalas a contactos'],
  [Briefcase, 'Gestioná ofertas, reservas y condiciones finales de la operación'],
] as const

export default function Step5Propiedades() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-success/10 flex items-center justify-center">
        <Building2 className="w-8 h-8 text-success" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>Gestión de propiedades</Heading>
        <Text tone="muted" className="max-w-sm">
          Una vez captada la propiedad, la gestionás desde documentación hasta la venta o alquiler.
        </Text>
      </div>

      {/* Pipeline mini */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {STAGES.map((stage, i) => (
          <div key={stage} className="flex items-center gap-1.5">
            <PropertyStageBadge stage={stage} />
            {i < STAGES.length - 1 && <span className="text-gray-300 text-xs">→</span>}
          </div>
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
