import { BookUser, Antenna, ClipboardList, Tag, AlertCircle } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

const FEATURES = [
  [Antenna, 'Registrá la fuente de cada lead: portal, referido, redes sociales, etc.'],
  [ClipboardList, 'Asigná seguimientos con fecha y próximo paso concreto'],
  [Tag, 'Etiquetá entre Propietario, Comprador, Inversor o Aliado'],
  [AlertCircle, 'Leads sin actividad por varios días se marcan automáticamente como vencidos'],
] as const

export default function Step3Leads() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-info/10 flex items-center justify-center">
        <BookUser className="w-8 h-8 text-info" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>Capturá tus prospectos</Heading>
        <Text tone="muted" className="max-w-sm">
          Cada interesado entra como Lead y avanza por el pipeline hasta convertirse en una captación o venta.
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
