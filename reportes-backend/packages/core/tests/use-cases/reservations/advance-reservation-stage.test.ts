import { describe, it, expect, vi } from 'vitest'
import { AdvanceReservationStageUseCase } from '../../../src/application/use-cases/reservations/advance-reservation-stage'
import { Reservation } from '../../../src/domain/entities/reservation'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockReservation = Reservation.create({
  id: 'res-1',
  org_id: 'org_mg',
  property_address: 'Av. Corrientes 1234',
  buyer_name: 'Juan',
  seller_name: 'María',
  agent_id: 'agent-1',
  offer_amount: 120000,
  offer_currency: 'USD',
  reservation_date: '2026-04-15',
  stage: 'reservada',
  notes: null,
})

const mockReservationRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockStageHistoryRepo = {
  findByEntity: vi.fn(),
  log: vi.fn().mockResolvedValue(undefined),
}

describe('AdvanceReservationStageUseCase', () => {
  it('advances stage and logs history', async () => {
    mockReservationRepo.findById.mockResolvedValue(mockReservation)

    const useCase = new AdvanceReservationStageUseCase(mockReservationRepo, mockStageHistoryRepo)
    await useCase.execute({ reservationId: 'res-1', orgId: 'org_mg', newStage: 'boleto', changedBy: 'agent-1' })

    expect(mockReservationRepo.save).toHaveBeenCalled()
    expect(mockStageHistoryRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ from_stage: 'reservada', to_stage: 'boleto' })
    )
  })

  it('throws NotFoundError when reservation not found', async () => {
    mockReservationRepo.findById.mockResolvedValue(null)

    const useCase = new AdvanceReservationStageUseCase(mockReservationRepo, mockStageHistoryRepo)
    await expect(useCase.execute({ reservationId: 'missing', orgId: 'org_mg', newStage: 'boleto', changedBy: 'agent-1' }))
      .rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError for invalid transition', async () => {
    mockReservationRepo.findById.mockResolvedValue(mockReservation)

    const useCase = new AdvanceReservationStageUseCase(mockReservationRepo, mockStageHistoryRepo)
    await expect(useCase.execute({ reservationId: 'res-1', orgId: 'org_mg', newStage: 'entregada', changedBy: 'agent-1' }))
      .rejects.toThrow(ValidationError)
  })
})
