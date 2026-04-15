import { describe, it, expect, vi } from 'vitest'
import { CreateLeadUseCase } from '../../../src/application/use-cases/leads/create-lead'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockLeadRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockIdGen = { generate: vi.fn().mockReturnValue('gen-id') }

describe('CreateLeadUseCase', () => {
  it('creates a lead and returns its id', async () => {
    const useCase = new CreateLeadUseCase(mockLeadRepo, mockIdGen)
    const result = await useCase.execute({
      org_id: 'org_mg',
      full_name: 'Ana López',
      phone: '1134567890',
      source: 'manual',
      assigned_to: 'agent-1',
    })

    expect(result.id).toBe('gen-id')
    expect(mockLeadRepo.save).toHaveBeenCalled()
  })

  it('throws ValidationError if full_name is too short', async () => {
    const useCase = new CreateLeadUseCase(mockLeadRepo, mockIdGen)
    await expect(useCase.execute({
      org_id: 'org_mg',
      full_name: 'A',
      phone: '1134567890',
      source: 'manual',
      assigned_to: 'agent-1',
    })).rejects.toThrow(ValidationError)
  })
})
