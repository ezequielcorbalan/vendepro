import { Building2, Camera, Globe, Eye, Briefcase, ArrowRight } from 'lucide-react'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { StepLayout } from './StepLayout'

// Las etapas salen de PROPERTY_STAGES vía PropertyStageBadge, así que el
// onboarding muestra los mismos colores que el pipeline real.
const stages = ['captada', 'publicada', 'reservada', 'vendida']

export default function Step5Propiedades() {
  return (
    <StepLayout
      icon={<Building2 className="w-8 h-8" />}
      iconClassName="bg-success/10 text-success"
      title="Gestión de propiedades"
      description="Una vez captada la propiedad, la gestionás desde documentación hasta la venta o alquiler."
      points={[
        { icon: <Camera className="w-4 h-4" />, text: 'Cargá fotos, fichas técnicas y documentación requerida' },
        { icon: <Globe className="w-4 h-4" />, text: 'Creá landing pages personalizadas para cada propiedad con un clic' },
        { icon: <Eye className="w-4 h-4" />, text: 'Registrá visitas de compradores y vinculalas a contactos' },
        { icon: <Briefcase className="w-4 h-4" />, text: 'Gestioná ofertas, reservas y condiciones finales de la operación' },
      ]}
    >
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {stages.map((stage, i) => (
          <div key={stage} className="flex items-center gap-1.5">
            <PropertyStageBadge stage={stage} />
            {i < stages.length - 1 && (
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </StepLayout>
  )
}
