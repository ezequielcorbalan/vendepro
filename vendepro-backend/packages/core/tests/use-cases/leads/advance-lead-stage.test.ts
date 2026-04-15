import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdvanceLeadStageUseCase } from '../../../src/application/use-cases/leads/advance-lead-stage'
import { Lead } from '../../../src/domain/entities/lead'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const makeNuevoLead = () => Lead.create({
  id: 'lead-1',
  org_id: 'org_mg',
  full_name: 'Juan Pérez',
  phone: '1134567890',
  email: null,
  source: 'manual',
  source_detail: null,
  property_address: null,
  neighborhood: 'Palermo',
  property_type: 'departamento',
  operation: 'venta',
  stage: 'nuevo',
  assigned_to: 'agent-1',
  notes: null,
  estimated_value: null,
  budget: null,
  timing: null,
  personas_trabajo: null,
  mascotas: null,
  next_step: null,
  next_step_date: null,
  lost_reason: null,
  first_contact_at: null,
})

const makeEnTasacionLead = () => Lead.create({
  id: 'lead-2',
  org_id: 'org_mg',
  full_name: 'Ana López',
  phone: '1134567891',
  email: null,
  source: 'manual',
  source_detail: null,
  property_address: null,
  neighborhood: 'Palermo',
  property_type: 'departamento',
  operation: 'venta',
  stage: 'en_tasacion',
  assigned_to: 'agent-1',
  notes: null,
  estimated_value: null,
  budget: null,
  timing: null,
  personas_trabajo: null,
  mascotas: null,
  next_step: null,
  next_step_date: null,
  lost_reason: null,
  first_contact_at: null,
})

const mockLeadRepo = { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
const mockCalendarRepo = { findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn() }
const mockStageHistoryRepo = { findByEntity: vi.fn(), log: vi.fn() }
const mockIdGen = { generate: vi.fn().mockReturnValue('new-id') }

beforeEach(() => {
  vi.clearAllMocks()
  mockLeadRepo.save.mockResolvedValue(undefined)
  mockCalendarRepo.save.mockResolvedValue(undefined)
  mockStageHistoryRepo.log.mockResolvedValue(undefined)
})

describe('AdvanceLeadStageUseCase', () => {
  it('advances stage and logs history', async () => {
    mockLeadRepo.findById.mockResolvedValue(makeNuevoLead())

    const useCase = new AdvanceLeadStageUseCase(mockLeadRepo, mockCalendarRepo, mockStageHistoryRepo, mockIdGen)
    const result = await useCase.execute({ leadId: 'lead-1', orgId: 'org_mg', newStage: 'contactado', changedBy: 'agent-1' })

    expect(mockLeadRepo.save).toHaveBeenCalled()
    expect(mockStageHistoryRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ from_stage: 'nuevo', to_stage: 'contactado' })
    )
    expect(result.autoFollowup).toBeNull()
  })

  it('creates followup calendar event when advancing to presentada', async () => {
    mockLeadRepo.findById.mockResolvedValue(makeEnTasacionLead())

    const useCase = new AdvanceLeadStageUseCase(mockLeadRepo, mockCalendarRepo, mockStageHistoryRepo, mockIdGen)
    const result = await useCase.execute({ leadId: 'lead-2', orgId: 'org_mg', newStage: 'presentada', changedBy: 'agent-1' })

    expect(mockCalendarRepo.save).toHaveBeenCalled()
    expect(result.autoFollowup).not.toBeNull()
  })

  it('throws NotFoundError when lead does not exist', async () => {
    mockLeadRepo.findById.mockResolvedValue(null)

    const useCase = new AdvanceLeadStageUseCase(mockLeadRepo, mockCalendarRepo, mockStageHistoryRepo, mockIdGen)
    await expect(useCase.execute({ leadId: 'missing', orgId: 'org_mg', newStage: 'contactado', changedBy: 'agent-1' }))
      .rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError for invalid stage transition', async () => {
    mockLeadRepo.findById.mockResolvedValue(makeNuevoLead())

    const useCase = new AdvanceLeadStageUseCase(mockLeadRepo, mockCalendarRepo, mockStageHistoryRepo, mockIdGen)
    await expect(useCase.execute({ leadId: 'lead-1', orgId: 'org_mg', newStage: 'captado', changedBy: 'agent-1' }))
      .rejects.toThrow(ValidationError)
  })
})
