import { BookUser, Antenna, ClipboardList, Tag, AlertCircle } from 'lucide-react'
import { StepLayout } from './StepLayout'

export default function Step3Leads() {
  return (
    <StepLayout
      icon={<BookUser className="w-8 h-8" />}
      iconClassName="bg-info/10 text-info"
      title="Capturá tus prospectos"
      description="Cada interesado entra como Lead y avanza por el pipeline hasta convertirse en una captación o venta."
      points={[
        { icon: <Antenna className="w-4 h-4" />, text: 'Registrá la fuente de cada lead: portal, referido, redes sociales, etc.' },
        { icon: <ClipboardList className="w-4 h-4" />, text: 'Asigná seguimientos con fecha y próximo paso concreto' },
        { icon: <Tag className="w-4 h-4" />, text: 'Etiquetá entre Propietario, Comprador, Inversor o Aliado' },
        { icon: <AlertCircle className="w-4 h-4" />, text: 'Leads sin actividad por varios días se marcan automáticamente como vencidos' },
      ]}
    />
  )
}
