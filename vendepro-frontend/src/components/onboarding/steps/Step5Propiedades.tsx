import { Building2, Camera, Globe, Eye, Briefcase } from 'lucide-react'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step5Propiedades() {
  return (
    <StepLayout
      icon={<Building2 className="w-7 h-7" />}
      title="Gestión de propiedades"
      subtitle="Una vez captada la propiedad, la gestionás desde documentación hasta la venta o alquiler."
    >
      {/* Los colores de cada etapa salen de crm-config vía PropertyStageBadge. */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {(['captada', 'publicada', 'reservada', 'vendida'] as const).map((stage, i, arr) => (
          <div key={stage} className="flex items-center gap-1.5">
            <PropertyStageBadge stage={stage} />
            {i < arr.length - 1 && <span className="text-gray-300 text-xs">→</span>}
          </div>
        ))}
      </div>

      <StepBullets
        items={[
          [<Camera key="a" className="w-4 h-4" />, 'Cargá fotos, fichas técnicas y documentación requerida'],
          [<Globe key="b" className="w-4 h-4" />, 'Creá landing pages personalizadas para cada propiedad con un clic'],
          [<Eye key="c" className="w-4 h-4" />, 'Registrá visitas de compradores y vinculalas a contactos'],
          [<Briefcase key="d" className="w-4 h-4" />, 'Gestioná ofertas, reservas y condiciones finales de la operación'],
        ]}
      />
    </StepLayout>
  )
}
