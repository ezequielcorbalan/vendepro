import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeleteAgentUseCase } from '../../../src/application/use-cases/admin/delete-agent'
import { RestoreAgentUseCase } from '../../../src/application/use-cases/admin/restore-agent'
import { GetDeletedAgentsUseCase } from '../../../src/application/use-cases/admin/get-deleted-agents'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findDeletedByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  restore: vi.fn().mockResolvedValue(undefined),
  updateRole: vi.fn().mockResolvedValue(undefined),
}

const agent = { id: 'agent-1', role: 'agent', active: 1 }
const base = { requestingUserId: 'admin-1', requestingUserRole: 'admin', agentId: 'agent-1', orgId: 'org_mg' }

beforeEach(() => {
  vi.clearAllMocks()
  mockUserRepo.findById.mockResolvedValue(agent)
})

describe('DeleteAgentUseCase', () => {
  it('admin can soft-delete an agent', async () => {
    await new DeleteAgentUseCase(mockUserRepo).execute(base)
    expect(mockUserRepo.delete).toHaveBeenCalledWith('agent-1', 'org_mg')
  })

  it('agent cannot delete other agents', async () => {
    await expect(
      new DeleteAgentUseCase(mockUserRepo).execute({ ...base, requestingUserRole: 'agent' }),
    ).rejects.toThrow(ForbiddenError)
    expect(mockUserRepo.delete).not.toHaveBeenCalled()
  })

  it('supervisor cannot delete agents', async () => {
    await expect(
      new DeleteAgentUseCase(mockUserRepo).execute({ ...base, requestingUserRole: 'supervisor' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('cannot delete yourself', async () => {
    await expect(
      new DeleteAgentUseCase(mockUserRepo).execute({ ...base, agentId: 'admin-1' }),
    ).rejects.toThrow(ValidationError)
    expect(mockUserRepo.delete).not.toHaveBeenCalled()
  })

  it('only the owner can delete an owner', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'agent-1', role: 'owner', active: 1 })
    await expect(new DeleteAgentUseCase(mockUserRepo).execute(base)).rejects.toThrow(ForbiddenError)

    await new DeleteAgentUseCase(mockUserRepo).execute({ ...base, requestingUserRole: 'owner' })
    expect(mockUserRepo.delete).toHaveBeenCalledWith('agent-1', 'org_mg')
  })

  it('throws NotFoundError when the agent is not in the org', async () => {
    mockUserRepo.findById.mockResolvedValue(null)
    await expect(new DeleteAgentUseCase(mockUserRepo).execute(base)).rejects.toThrow(NotFoundError)
  })
})

describe('RestoreAgentUseCase', () => {
  const restoreInput = { requestingUserRole: 'admin', agentId: 'agent-1', orgId: 'org_mg' }

  it('restores an agent from the trash', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'agent-1', role: 'agent', active: 0 })
    await new RestoreAgentUseCase(mockUserRepo).execute(restoreInput)
    expect(mockUserRepo.restore).toHaveBeenCalledWith('agent-1', 'org_mg')
  })

  it('rejects restoring an agent that is not deleted', async () => {
    await expect(new RestoreAgentUseCase(mockUserRepo).execute(restoreInput)).rejects.toThrow(ValidationError)
  })

  it('agent cannot restore', async () => {
    mockUserRepo.findById.mockResolvedValue({ id: 'agent-1', role: 'agent', active: 0 })
    await expect(
      new RestoreAgentUseCase(mockUserRepo).execute({ ...restoreInput, requestingUserRole: 'agent' }),
    ).rejects.toThrow(ForbiddenError)
  })
})

describe('GetDeletedAgentsUseCase', () => {
  it('admin gets the trash', async () => {
    mockUserRepo.findDeletedByOrg.mockResolvedValue([agent])
    const result = await new GetDeletedAgentsUseCase(mockUserRepo).execute('org_mg', 'admin')
    expect(result).toEqual([agent])
  })

  it('agent cannot see the trash', async () => {
    await expect(new GetDeletedAgentsUseCase(mockUserRepo).execute('org_mg', 'agent')).rejects.toThrow(ForbiddenError)
  })
})
