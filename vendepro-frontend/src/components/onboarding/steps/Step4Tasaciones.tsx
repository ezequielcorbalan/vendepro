import { ClipboardList, FileText, FileDown, Handshake, CheckCircle2 } from 'lucide-react'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step4Tasaciones() {
  return (
    <StepLayout
      icon={<ClipboardList className="w-7 h-7" />}
      title="Tasaciones profesionales"
      subtitle="Cuando un propietario quiere vender, abrís una Tasación vinculada al lead y gestionás todo el proceso desde ahí."
    >
      <StepBullets
        items={[
          [<FileText key="a" className="w-4 h-4" />, 'Completá el informe con bloques editables: descripción, comparables, entorno'],
          [<FileDown key="b" className="w-4 h-4" />, 'Generá un PDF profesional con tu marca para presentar al cliente'],
          [<Handshake key="c" className="w-4 h-4" />, 'Registrá las condiciones de trabajo: comisión, exclusividad, precio acordado'],
          [<CheckCircle2 key="d" className="w-4 h-4" />, 'Al aprobar la tasación, se crea automáticamente la Propiedad en el pipeline'],
        ]}
      />
    </StepLayout>
  )
}
