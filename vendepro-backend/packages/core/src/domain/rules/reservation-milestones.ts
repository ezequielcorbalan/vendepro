import type { ReservationStage } from './reservation-rules'
import { daysUntil } from './authorization-rules'

/**
 * Hitos de una reserva, en orden, para la línea de tiempo del portal del
 * propietario y de la ficha. Cuál ya pasó lo dice el `stage` (y `accepted_at`
 * para la aceptación); las fechas son las previstas que carga el agente.
 */
export type ReservationMilestoneKey = 'aceptacion' | 'boleto' | 'escritura' | 'entrega'

export interface ReservationMilestone {
  key: ReservationMilestoneKey
  label: string
  /** YYYY-MM-DD previsto, o null si todavía no se cargó. */
  date: string | null
  done: boolean
  /** Días corridos hasta la fecha (negativo = vencido). null si ya pasó o no hay fecha. */
  days_left: number | null
  overdue: boolean
}

export interface ReservationMilestonesInput {
  stage: ReservationStage
  accepted_at?: string | null
  acceptance_deadline?: string | null
  boleto_date?: string | null
  escritura_date?: string | null
  delivery_date?: string | null
}

export const RESERVATION_MILESTONE_LABELS: Record<ReservationMilestoneKey, string> = {
  aceptacion: 'Aceptación de la oferta',
  boleto: 'Firma del boleto',
  escritura: 'Escritura',
  entrega: 'Entrega de llaves',
}

const STAGE_ORDER: ReservationStage[] = ['reservada', 'boleto', 'escritura', 'entregada']

/** Una reserva cancelada o rechazada no tiene línea de tiempo que mostrar. */
export function isReservationClosed(stage: ReservationStage): boolean {
  return stage === 'cancelada' || stage === 'rechazada'
}

export function computeReservationMilestones(r: ReservationMilestonesInput, today: string): ReservationMilestone[] {
  const reached = STAGE_ORDER.indexOf(r.stage)
  const past = (stage: ReservationStage) => reached >= STAGE_ORDER.indexOf(stage)
  const rows: Array<[ReservationMilestoneKey, string | null | undefined, boolean]> = [
    // Firmar el boleto implica que la oferta se aceptó aunque no se haya marcado.
    ['aceptacion', r.acceptance_deadline, !!r.accepted_at || past('boleto')],
    ['boleto', r.boleto_date, past('boleto')],
    ['escritura', r.escritura_date, past('escritura')],
    ['entrega', r.delivery_date, past('entregada')],
  ]
  return rows.map(([key, date, done]) => {
    const clean = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null
    const days = done ? null : daysUntil(clean, today)
    return {
      key,
      label: RESERVATION_MILESTONE_LABELS[key],
      date: clean,
      done,
      days_left: days,
      overdue: days !== null && days < 0,
    }
  })
}

/** El próximo hito pendiente (el que lleva la cuenta regresiva), o null si terminó. */
export function nextReservationMilestone(milestones: ReservationMilestone[]): ReservationMilestone | null {
  return milestones.find((m) => !m.done) ?? null
}
