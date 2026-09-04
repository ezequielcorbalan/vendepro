import type { ActivityType } from '../entities/activity'
import type { EventTypeValue } from '../value-objects/event-type'

/**
 * Un evento de calendario completado ES actividad comercial.
 *
 * El calendario es la herramienta que el agente usa igual: agenda la visita,
 * la hace, la tilda. Pedirle además que cargue la actividad a mano era pedirle
 * cargar el mismo hecho dos veces — y no lo hacía nadie (68 leads contactados
 * y 0 actividades en el dashboard). Así que la actividad se deriva del evento.
 *
 * Este archivo es la única fuente de esa traducción: qué tipo de evento
 * cuenta como qué tipo de actividad, y cuáles no cuentan.
 */

/**
 * Tipos de evento que NO generan actividad comercial:
 * - `admin`: trabajo interno (papeleo, reuniones de equipo), no contacto con
 *   el cliente. Cuenta como agenda, no como gestión comercial.
 * - `otro`: sin semántica; no se puede afirmar qué fue.
 *
 * El resto sí genera, incluido `seguimiento`, que es gestión sobre el lead.
 */
const EVENT_TO_ACTIVITY: Partial<Record<EventTypeValue, ActivityType>> = {
  llamada:          'llamada',
  reunion:          'reunion',
  visita_captacion: 'visita_captacion',
  visita_comprador: 'visita_comprador',
  tasacion:         'tasacion',
  seguimiento:      'seguimiento',
  // Una firma es el cierre de la operación.
  firma:            'cierre',
}

/** Tipo de actividad que corresponde a un evento, o null si no aplica. */
export function activityTypeForEvent(eventType: EventTypeValue): ActivityType | null {
  return EVENT_TO_ACTIVITY[eventType] ?? null
}

/**
 * Duración en minutos a partir del horario del evento. Devuelve null cuando
 * no se puede afirmar (falta un extremo, es de día completo, o las fechas son
 * inconsistentes): es mejor no informar duración que informar una inventada,
 * porque este número alimenta las métricas de performance.
 */
export function eventDurationMinutes(
  startAt: string | null,
  endAt: string | null,
  allDay: number,
): number | null {
  if (allDay) return null
  if (!startAt || !endAt) return null
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  const minutes = Math.round((end - start) / 60000)
  return minutes > 0 ? minutes : null
}
