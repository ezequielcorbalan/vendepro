import { describe, it, expect, vi } from 'vitest'
import { CreateAgentUseCase } from '../../../src/application/use-cases/admin/create-agent'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('hashed'),
  verifyPassword: vi.fn(),
  createToken: vi.fn(),
  verifyToken: vi.fn(),
}
const mockIdGen = { generate: vi.fn().mockReturnValue('new-agent-id') }

describe('CreateAgentUseCase', () => {
  it('admin can create an agent', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null)

    const useCase = new CreateAgentUseCase(mockUserRepo, mockAuthService, mockIdGen)
    const result = await useCase.execute({
      requestingUserRole: 'admin',
      org_id: 'org_mg',
      email: 'newagent@mg.com',
      password: 'password123',
      name: 'New Agent',
      role: 'agent',
    })

    expect(result.id).toBe('new-agent-id')
    expect(mockUserRepo.save).toHaveBeenCalled()
  })

  it('agent cannot create other agents', async () => {
    const useCase = new CreateAgentUseCase(mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute({
      requestingUserRole: 'agent',
      org_id: 'org_mg',
      email: 'another@mg.com',
      password: 'password123',
      name: 'Another Agent',
      role: 'agent',
    })).rejects.toThrow(ForbiddenError)
  })

  it('throws ValidationError for duplicate email', async () => {
    const existingUser = { id: 'user-existing' }
    mockUserRepo.findByEmail.mockResolvedValue(existingUser)

    const useCase = new CreateAgentUseCase(mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      org_id: 'org_mg',
      email: 'duplicate@mg.com',
      password: 'password123',
      name: 'Dup Agent',
      role: 'agent',
    })).rejects.toThrow(ValidationError)
  })
})
