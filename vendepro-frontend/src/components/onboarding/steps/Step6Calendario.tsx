import { CalendarDays, Calendar, NotebookPen, Clock, AlertTriangle } from 'lucide-react'
import { EventChip } from '@/components/ui/EventChip'
import { StepLayout } from './StepLayout'

// Los chips salen de EVENT_TYPES vía EventChip: mismo ícono, color y label que
// en el calendario real.
const eventTypes = ['llamada', 'reunion', 'visita_captacion', 'tasacion', 'seguimiento', 'firma'] as const

export default function Step6Calendario() {
  return (
    <StepLayout
      icon={<CalendarDays className="w-8 h-8" />}
      iconClassName="bg-info/10 text-info"
      title="Calendario y actividades"
      description="Programá eventos y registrá actividades vinculadas directamente a tus leads, contactos y propiedades."
      points={[
        { icon: <Calendar className="w-4 h-4" />, text: 'Vista mensual del calendario con todos tus eventos del equipo' },
        { icon: <NotebookPen className="w-4 h-4" />, text: 'Registrá cada llamada, WhatsApp y visita en el historial del cliente' },
        { icon: <Clock className="w-4 h-4" />, text: 'El dashboard muestra los eventos de hoy y los seguimientos pendientes' },
        { icon: <AlertTriangle className="w-4 h-4" />, text: 'Los eventos vencidos sin completar se marcan en rojo automáticamente' },
      ]}
    >
      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
        {eventTypes.map(type => (
          <EventChip key={type} type={type} />
        ))}
      </div>
    </StepLayout>
  )
}
