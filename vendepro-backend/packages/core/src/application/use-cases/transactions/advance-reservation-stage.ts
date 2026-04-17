import type { ReservationRepository } from '../../ports/repositories/reservation-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import type { ReservationStage } from '../../../domain/rules/reservation-rules'

export interface AdvanceReservationStageInput {
  reservationId: string
  orgId: string
  newStage: ReservationStage
  changedBy: string
  notes?: string | null
}

export class AdvanceReservationStageUseCase {
  constructor(
    private readonly reservationRepo: ReservationRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
  ) {}

  async execute(input: AdvanceReservationStageInput): Promise<void> {
    const reservation = await this.reservationRepo.findById(input.reservationId, input.orgId)
    if (!reservation) throw new NotFoundError('Reserva no encontrada')

    const fromStage = reservation.stage
    reservation.advanceStage(input.newStage)
    await this.reservationRepo.save(reservation)

    await this.stageHistoryRepo.log({
      org_id: input.orgId,
      entity_type: 'reservation',
      entity_id: reservation.id,
      from_stage: fromStage,
      to_stage: input.newStage,
      changed_by: input.changedBy,
      notes: input.notes ?? null,
    })
  }
}
