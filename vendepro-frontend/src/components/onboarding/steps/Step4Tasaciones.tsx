import { ClipboardList, PencilLine, FileText, Handshake, CheckCircle2 } from 'lucide-react'
import { StepLayout } from './StepLayout'

export default function Step4Tasaciones() {
  return (
    <StepLayout
      icon={<ClipboardList className="w-8 h-8" />}
      iconClassName="bg-purple/10 text-purple"
      title="Tasaciones profesionales"
      description="Cuando un propietario quiere vender, abrís una Tasación vinculada al lead y gestionás todo el proceso desde ahí."
      points={[
        { icon: <PencilLine className="w-4 h-4" />, text: 'Completá el informe con bloques editables: descripción, comparables, entorno' },
        { icon: <FileText className="w-4 h-4" />, text: 'Generá un PDF profesional con tu marca para presentar al cliente' },
        { icon: <Handshake className="w-4 h-4" />, text: 'Registrá las condiciones de trabajo: comisión, exclusividad, precio acordado' },
        { icon: <CheckCircle2 className="w-4 h-4" />, text: 'Al aprobar la tasación, se crea automáticamente la Propiedad en el pipeline' },
      ]}
    />
  )
}
