import { Home, Target, RefreshCw, CalendarCheck } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

const FEATURES = [
  [Target, 'Gestioná leads, tasaciones y propiedades en un solo lugar'],
  [RefreshCw, 'Seguí cada operación desde el primer contacto hasta la venta'],
  [CalendarCheck, 'Automatizá tu seguimiento y nunca pierdas un cliente'],
] as const

export default function Step1Welcome({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-lg shadow-primary/20">
        <Home className="w-10 h-10 text-white" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <Heading level={2}>
          ¡Bienvenido{name ? `, ${name.split(' ')[0]}` : ''}!
        </Heading>
        <Text tone="muted" className="max-w-sm">
          VendéPro es el CRM diseñado para inmobiliarias. En unos minutos te mostramos cómo sacarle el máximo provecho.
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
