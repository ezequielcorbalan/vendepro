import type { ReservationRepository } from '../../ports/repositories/reservation-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Reservation } from '../../../domain/entities/reservation'

export interface CreateReservationInput {
  org_id: string
  agent_id: string
  property_address?: string | null
  buyer_name?: string | null
  seller_name?: string | null
  offer_amount?: number | null
  offer_currency?: string
  reservation_date?: string | null
  notes?: string | null
}

export class CreateReservationUseCase {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateReservationInput): Promise<{ id: string }> {
    const reservation = Reservation.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      property_address: input.property_address ?? null,
      buyer_name: input.buyer_name ?? null,
      seller_name: input.seller_name ?? null,
      agent_id: input.agent_id,
      offer_amount: input.offer_amount ?? null,
      offer_currency: input.offer_currency ?? 'USD',
      reservation_date: input.reservation_date ?? null,
      stage: 'reservada',
      notes: input.notes ?? null,
    })

    await this.reservationRepo.save(reservation)

    await this.stageHistoryRepo.log({
      org_id: input.org_id,
      entity_type: 'reservation',
      entity_id: reservation.id,
      from_stage: null,
      to_stage: 'reservada',
      changed_by: input.agent_id,
      notes: null,
    })

    return { id: reservation.id }
  }
}
