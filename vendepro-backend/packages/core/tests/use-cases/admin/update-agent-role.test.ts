import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateAgentRoleUseCase } from '../../../src/application/use-cases/admin/update-agent-role'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'
import { User } from '../../../src/domain/entities/user'
import { Role } from '../../../src/domain/entities/role'

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

const supervisorRole = Role.create({ id: 3, name: 'supervisor', label: 'Supervisor' })
const ownerRole = Role.create({ id: 1, name: 'owner', label: 'Propietario' })

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn().mockResolvedValue(undefined),
  findFirstAdminByOrg: vi.fn(),
  findProfileById: vi.fn(),
  updateProfile: vi.fn(),
}

const mockRoleRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
}

describe('UpdateAgentRoleUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRepo.updateRole.mockResolvedValue(undefined)
  })

  it('admin can change agent role — fetches role internally', async () => {
    mockRoleRepo.findById.mockResolvedValue(supervisorRole)
    mockUserRepo.findById.mockResolvedValue(agentUser)

    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 3,
    })

    expect(mockRoleRepo.findById).toHaveBeenCalledWith(3)
    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 3, 'supervisor')
  })

  it('agent cannot change roles', async () => {
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await expect(useCase.execute({
      requestingUserRole: 'agent',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 2,
    })).rejects.toThrow(ForbiddenError)
    expect(mockRoleRepo.findById).not.toHaveBeenCalled()
  })

  it('admin cannot assign owner role', async () => {
    mockRoleRepo.findById.mockResolvedValue(ownerRole)
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
    })).rejects.toThrow(ForbiddenError)
  })

  it('owner can assign owner role', async () => {
    mockRoleRepo.findById.mockResolvedValue(ownerRole)
    mockUserRepo.findById.mockResolvedValue(agentUser)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await useCase.execute({
      requestingUserRole: 'owner',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 1,
    })
    expect(mockUserRepo.updateRole).toHaveBeenCalledWith('agent-1', 'org_mg', 1, 'owner')
  })

  it('throws NotFoundError when agent does not exist', async () => {
    mockRoleRepo.findById.mockResolvedValue(supervisorRole)
    mockUserRepo.findById.mockResolvedValue(null)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'nonexistent',
      orgId: 'org_mg',
      roleId: 3,
    })).rejects.toThrow(NotFoundError)
  })

  it('throws ValidationError when role does not exist', async () => {
    mockRoleRepo.findById.mockResolvedValue(null)
    const useCase = new UpdateAgentRoleUseCase(mockUserRepo, mockRoleRepo)
    await expect(useCase.execute({
      requestingUserRole: 'admin',
      agentId: 'agent-1',
      orgId: 'org_mg',
      roleId: 99,
    })).rejects.toThrow(ValidationError)
    expect(mockUserRepo.findById).not.toHaveBeenCalled()
  })
})
