import { CalendarDays, NotebookPen, Clock, AlertTriangle } from 'lucide-react'
import { EventChip } from '@/components/ui/EventChip'
import { Heading, Text } from '@/components/ui/Typography'

// Tipos reales del calendario: EventChip toma color, ícono y label de
// EVENT_TYPES, así el onboarding no puede divergir de la app.
const EVENT_TYPES_DEMO = ['llamada', 'reunion', 'visita_comprador', 'tasacion', 'seguimiento', 'firma'] as const

const FEATURES = [
  [CalendarDays, 'Vista mensual del calendario con todos tus eventos del equipo'],
  [NotebookPen, 'Registrá cada llamada, WhatsApp y visita en el historial del cliente'],
  [Clock, 'El dashboard muestra los eventos de hoy y los seguimientos pendientes'],
  [AlertTriangle, 'Los eventos vencidos sin completar se marcan en rojo automáticamente'],
] as const

export default function Step6Calendario() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-control bg-info/10 flex items-center justify-center">
        <CalendarDays className="w-8 h-8 text-info" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <Heading level={2}>Calendario y actividades</Heading>
        <Text tone="muted" className="max-w-sm">
          Programá eventos y registrá actividades vinculadas directamente a tus leads, contactos y propiedades.
        </Text>
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
        {EVENT_TYPES_DEMO.map(type => (
          <EventChip key={type} type={type} />
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
