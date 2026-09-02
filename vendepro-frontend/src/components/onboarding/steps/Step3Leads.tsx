import { BookUser, Megaphone, ClipboardList, Tag, AlertTriangle } from 'lucide-react'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step3Leads() {
  return (
    <StepLayout
      icon={<BookUser className="w-7 h-7" />}
      title="Capturá tus prospectos"
      subtitle="Cada interesado entra como Lead y avanza por el pipeline hasta convertirse en una captación o venta."
    >
      <StepBullets
        items={[
          [<Megaphone key="a" className="w-4 h-4" />, 'Registrá la fuente de cada lead: portal, referido, redes sociales, etc.'],
          [<ClipboardList key="b" className="w-4 h-4" />, 'Asigná seguimientos con fecha y próximo paso concreto'],
          [<Tag key="c" className="w-4 h-4" />, 'Etiquetá entre Propietario, Comprador, Inversor o Aliado'],
          [<AlertTriangle key="d" className="w-4 h-4" />, 'Leads sin actividad por varios días se marcan automáticamente como vencidos'],
        ]}
      />
    </StepLayout>
  )
}
