import { ClipboardList, PenLine, FileText, Handshake, CheckCircle2 } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

const FEATURES = [
  [PenLine, 'Completá el informe con bloques editables: descripción, comparables, entorno'],
  [FileText, 'Generá un PDF profesional con tu marca para presentar al cliente'],
  [Handshake, 'Registrá las condiciones de trabajo: comisión, exclusividad, precio acordado'],
  [CheckCircle2, 'Al aprobar la tasación, se crea automáticamente la Propiedad en el pipeline'],
] as const

export default function Step4Tasaciones() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-purple/10 flex items-center justify-center">
        <ClipboardList className="w-8 h-8 text-purple" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>Tasaciones profesionales</Heading>
        <Text tone="muted" className="max-w-sm">
          Cuando un propietario quiere vender, abrís una Tasación vinculada al lead y gestionás todo el proceso desde ahí.
        </Text>
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
