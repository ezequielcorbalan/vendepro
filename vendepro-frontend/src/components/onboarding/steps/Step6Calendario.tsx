import { CalendarDays, ClipboardList, Clock, AlertTriangle } from 'lucide-react'
import { EventChip } from '@/components/ui/EventChip'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step6Calendario() {
  return (
    <StepLayout
      icon={<CalendarDays className="w-7 h-7" />}
      title="Calendario y actividades"
      subtitle="Programá eventos y registrá actividades vinculadas directamente a tus leads, contactos y propiedades."
    >
      {/* Los tipos de evento (label, color e ícono) salen de EVENT_TYPES en
          crm-config: acá no se inventa ninguno. */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
        {(['llamada', 'reunion', 'visita_captacion', 'tasacion', 'seguimiento', 'firma'] as const).map(t => (
          <EventChip key={t} type={t} />
        ))}
      </div>

      <StepBullets
        items={[
          [<CalendarDays key="a" className="w-4 h-4" />, 'Vista mensual del calendario con todos tus eventos del equipo'],
          [<ClipboardList key="b" className="w-4 h-4" />, 'Registrá cada llamada, WhatsApp y visita en el historial del cliente'],
          [<Clock key="c" className="w-4 h-4" />, 'El dashboard muestra los eventos de hoy y los seguimientos pendientes'],
          [<AlertTriangle key="d" className="w-4 h-4" />, 'Los eventos vencidos sin completar se marcan en rojo automáticamente'],
        ]}
      />
    </StepLayout>
  )
}
