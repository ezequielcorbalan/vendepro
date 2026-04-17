import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetRolesUseCase } from '../../../src/application/use-cases/admin/get-roles'
import { UnauthorizedError } from '../../../src/domain/errors/unauthorized'
import { Role } from '../../../src/domain/entities/role'

const mockRoles = [
  Role.create({ id: 1, name: 'owner', label: 'Propietario' }),
  Role.create({ id: 2, name: 'admin', label: 'Administrador' }),
  Role.create({ id: 3, name: 'agent', label: 'Agente' }),
]

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
}

describe('GetRolesUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('admin can list roles', async () => {
    mockRepo.findAll.mockResolvedValue(mockRoles)
    const useCase = new GetRolesUseCase(mockRepo)
    const result = await useCase.execute('admin')
    expect(result).toHaveLength(3)
    expect(mockRepo.findAll).toHaveBeenCalledOnce()
  })

  it('owner can list roles', async () => {
    mockRepo.findAll.mockResolvedValue(mockRoles)
    const useCase = new GetRolesUseCase(mockRepo)
    const result = await useCase.execute('owner')
    expect(result).toHaveLength(3)
  })

  it('agent cannot list roles — throws UnauthorizedError', async () => {
    const useCase = new GetRolesUseCase(mockRepo)
    await expect(useCase.execute('agent')).rejects.toThrow(UnauthorizedError)
    expect(mockRepo.findAll).not.toHaveBeenCalled()
  })

  it('returns empty array when no roles exist', async () => {
    mockRepo.findAll.mockResolvedValue([])
    const useCase = new GetRolesUseCase(mockRepo)
    const result = await useCase.execute('admin')
    expect(result).toHaveLength(0)
  })
})
