import { ValidationError } from '../errors/validation-error'
import type { ReservationStage } from '../rules/reservation-rules'
import { canTransitionReservationStage } from '../rules/reservation-rules'

export interface ReservationProps {
  id: string
  org_id: string
  property_address: string | null
  buyer_name: string | null
  seller_name: string | null
  agent_id: string
  offer_amount: number | null
  offer_currency: string
  reservation_date: string | null
  stage: ReservationStage
  notes: string | null
  // Migración 064: propiedad y fechas previstas de cada hito.
  property_id?: string | null
  acceptance_deadline?: string | null
  accepted_at?: string | null
  boleto_date?: string | null
  escritura_date?: string | null
  delivery_date?: string | null
  created_at: string
  updated_at: string
  // Joined
  agent_name?: string
}

const VALID_STAGES: ReservationStage[] = ['reservada', 'boleto', 'escritura', 'entregada', 'cancelada', 'rechazada']

export class Reservation {
  private constructor(private props: ReservationProps) {}

  static create(props: Omit<ReservationProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Reservation {
    if (!VALID_STAGES.includes(props.stage)) throw new ValidationError(`Stage inválido: "${props.stage}"`)
    const now = new Date().toISOString()
    return new Reservation({ ...props, created_at: props.created_at ?? now, updated_at: props.updated_at ?? now })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_address() { return this.props.property_address }
  get buyer_name() { return this.props.buyer_name }
  get seller_name() { return this.props.seller_name }
  get agent_id() { return this.props.agent_id }
  get offer_amount() { return this.props.offer_amount }
  get offer_currency() { return this.props.offer_currency }
  get reservation_date() { return this.props.reservation_date }
  get stage() { return this.props.stage }
  get notes() { return this.props.notes }
  get property_id() { return this.props.property_id ?? null }
  get acceptance_deadline() { return this.props.acceptance_deadline ?? null }
  get accepted_at() { return this.props.accepted_at ?? null }
  get boleto_date() { return this.props.boleto_date ?? null }
  get escritura_date() { return this.props.escritura_date ?? null }
  get delivery_date() { return this.props.delivery_date ?? null }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }
  get agent_name() { return this.props.agent_name }

  advanceStage(newStage: ReservationStage): void {
    if (!canTransitionReservationStage(this.props.stage, newStage)) {
      throw new ValidationError(`Transición inválida de "${this.props.stage}" a "${newStage}"`)
    }
    this.props.stage = newStage
    this.props.updated_at = new Date().toISOString()
  }

  update(data: Partial<Omit<ReservationProps, 'id' | 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, data)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): ReservationProps { return { ...this.props } }
}
