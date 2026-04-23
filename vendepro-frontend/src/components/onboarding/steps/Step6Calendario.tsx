import { CalendarDays } from 'lucide-react'

export default function Step6Calendario() {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
        <CalendarDays className="w-8 h-8 text-blue-600" />
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gray-800">Calendario y actividades</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Programá eventos y registrá actividades vinculadas directamente a tus leads, contactos y propiedades.
        </p>
      </div>

      {/* Event type pills */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-sm">
        {[
          { label: '📞 Llamada', color: 'bg-blue-50 text-blue-600' },
          { label: '👥 Reunión', color: 'bg-purple-50 text-purple-600' },
          { label: '🏠 Visita', color: 'bg-green-50 text-green-600' },
          { label: '📋 Tasación', color: 'bg-orange-50 text-orange-600' },
          { label: '🔔 Seguimiento', color: 'bg-yellow-50 text-yellow-700' },
          { label: '✍️ Firma', color: 'bg-pink-50 text-pink-600' },
        ].map(ev => (
          <span key={ev.label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ev.color}`}>
            {ev.label}
          </span>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 text-left">
        {[
          ['📆', 'Vista mensual del calendario con todos tus eventos del equipo'],
          ['📝', 'Registrá cada llamada, WhatsApp y visita en el historial del cliente'],
          ['⏰', 'El dashboard muestra los eventos de hoy y los seguimientos pendientes'],
          ['🚨', 'Los eventos vencidos sin completar se marcan en rojo automáticamente'],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <p className="text-sm text-gray-700">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
