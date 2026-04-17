import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateLeadWithContactUseCase } from '../../../src/application/use-cases/leads/create-lead-with-contact'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockLeadRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}

const mockContactRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  findWithLeadsAndProperties: vi.fn(),
}

let idCounter = 0
const mockIds = {
  generate: vi.fn().mockImplementation(() => `gen-id-${++idCounter}`),
}

describe('CreateLeadWithContactUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    idCounter = 0
    mockIds.generate.mockImplementation(() => `gen-id-${++idCounter}`)
    mockLeadRepo.save.mockResolvedValue(undefined)
    mockContactRepo.save.mockResolvedValue(undefined)
  })

  it('with contact_id: only calls leadRepo.save, not contactRepo.save', async () => {
    const useCase = new CreateLeadWithContactUseCase(mockLeadRepo, mockContactRepo, mockIds)
    const result = await useCase.execute({
      org_id: 'org_mg',
      assigned_to: 'agent-1',
      full_name: 'Ana López',
      source: 'manual',
      contact_id: 'existing-contact-id',
    })

    expect(mockContactRepo.save).not.toHaveBeenCalled()
    expect(mockLeadRepo.save).toHaveBeenCalledTimes(1)
    expect(result.contact_id).toBe('existing-contact-id')
    expect(result.id).toBe('gen-id-1')
  })

  it('with contact_data and no contact_id: creates contact then lead, returns both ids', async () => {
    const useCase = new CreateLeadWithContactUseCase(mockLeadRepo, mockContactRepo, mockIds)
    const result = await useCase.execute({
      org_id: 'org_mg',
      assigned_to: 'agent-1',
      source: 'manual',
      contact_data: { full_name: 'María García', phone: '1134567890' },
    })

    expect(mockContactRepo.save).toHaveBeenCalledTimes(1)
    expect(mockLeadRepo.save).toHaveBeenCalledTimes(1)
    expect(result.contact_id).toBe('gen-id-1')
    expect(result.id).toBe('gen-id-2')
  })

  it('with contact_data AND contact_id: prefers contact_id, ignores contact_data', async () => {
    const useCase = new CreateLeadWithContactUseCase(mockLeadRepo, mockContactRepo, mockIds)
    const result = await useCase.execute({
      org_id: 'org_mg',
      assigned_to: 'agent-1',
      full_name: 'Juan Pérez',
      source: 'manual',
      contact_id: 'explicit-contact-id',
      contact_data: { full_name: 'Should Not Be Used' },
    })

    expect(mockContactRepo.save).not.toHaveBeenCalled()
    expect(result.contact_id).toBe('explicit-contact-id')
  })

  it('with neither contact_id nor contact_data: throws ValidationError', async () => {
    const useCase = new CreateLeadWithContactUseCase(mockLeadRepo, mockContactRepo, mockIds)
    await expect(useCase.execute({
      org_id: 'org_mg',
      assigned_to: 'agent-1',
      full_name: 'Sin Contacto',
      source: 'manual',
    })).rejects.toThrow(ValidationError)
  })

  it('contactRepo.save throws: error propagates', async () => {
    mockContactRepo.save.mockRejectedValue(new Error('DB error'))
    const useCase = new CreateLeadWithContactUseCase(mockLeadRepo, mockContactRepo, mockIds)
    await expect(useCase.execute({
      org_id: 'org_mg',
      assigned_to: 'agent-1',
      source: 'manual',
      contact_data: { full_name: 'Error Contact' },
    })).rejects.toThrow('DB error')
    expect(mockLeadRepo.save).not.toHaveBeenCalled()
  })
})
