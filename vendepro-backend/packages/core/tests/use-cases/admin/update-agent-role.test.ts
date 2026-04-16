import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateAgentRoleUseCase } from '../../../src/application/use-cases/admin/update-agent-role'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { User } from '../../../src/domain/entities/user'

const agentUser = User.create({
  id: 'agent-1',
  email: 'agent@mg.com',
  password_hash: 'hashed',
  full_name: 'Juan Agente',
  phone: null,
  photo_url: null,
  role: 'agent',
  org_id: 'org_mg',
  active: 1,
})

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn().mockResolvedValue(undefined),
}

describe('UpdateAgentRoleUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRepo.updateRole.mockResolvedValue(undefined)
  })

  it('admin can change agent role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)

    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 3,
      roleName: 'supervisor',
    })

    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 3, 'supervisor')
  })

  it('agent cannot change roles', async () => {
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'agent',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 2,
      roleName: 'admin',
    })).rejects.toThrow(ForbiddenError)
  })

  it('admin cannot assign owner role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
      roleName: 'owner',
    })).rejects.toThrow(ForbiddenError)
  })

  it('owner can assign owner role', async () => {
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await useCase.execute({
      requestingUserRole: 'owner',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
      roleName: 'owner',
    })
    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 1, 'owner')
  })

  it('throws NotFoundError when agent does not exist', async () => {
    mockUserRepo.findById.mockResolvedValue(null)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'nonexistent',
      orgId: 'org_mg',
      roleId: 3,
      roleName: 'supervisor',
    })).rejects.toThrow(NotFoundError)
  })
})
