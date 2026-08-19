import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateAgentUseCase } from '../../../src/application/use-cases/admin/update-agent'
import { ForbiddenError } from '../../../src/domain/errors/forbidden'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  findDeletedByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  restore: vi.fn(),
  updateRole: vi.fn(),
}
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('nuevo-hash'),
  verifyPassword: vi.fn(),
  createToken: vi.fn(),
  verifyToken: vi.fn(),
}

function fakeUser(overrides: Record<string, any> = {}) {
  const props = {
    id: 'agent-1',
    email: 'agente@mg.com',
    password_hash: 'hash-viejo',
    full_name: 'Agente Uno',
    phone: '1122334455',
    photo_url: null,
    role: 'agent',
    org_id: 'org_mg',
    active: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return { ...props, toObject: () => ({ ...props }) }
}

const base = { requestingUserRole: 'admin', agentId: 'agent-1', orgId: 'org_mg' }

function savedProps() {
  return mockUserRepo.save.mock.calls[0][0].toObject()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUserRepo.findById.mockResolvedValue(fakeUser())
  mockUserRepo.findByEmail.mockResolvedValue(null)
  mockAuthService.hashPassword.mockResolvedValue('nuevo-hash')
})

describe('UpdateAgentUseCase', () => {
  it('updates name, email and phone', async () => {
    await new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({
      ...base, full_name: 'Agente Editado', email: 'Nuevo@MG.com ', phone: '99999',
    })
    const saved = savedProps()
    expect(saved.full_name).toBe('Agente Editado')
    expect(saved.email).toBe('nuevo@mg.com')
    expect(saved.phone).toBe('99999')
  })

  it('keeps the current password when none is sent', async () => {
    await new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, full_name: 'X' })
    expect(mockAuthService.hashPassword).not.toHaveBeenCalled()
    expect(savedProps().password_hash).toBe('hash-viejo')
  })

  it('hashes the new password when one is sent', async () => {
    await new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, password: 'secreto123' })
    expect(mockAuthService.hashPassword).toHaveBeenCalledWith('secreto123')
    expect(savedProps().password_hash).toBe('nuevo-hash')
  })

  it('rejects passwords shorter than 6 characters', async () => {
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, password: '123' }),
    ).rejects.toThrow(ValidationError)
    expect(mockUserRepo.save).not.toHaveBeenCalled()
  })

  it('rejects an email already used by another user', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'otro-user' })
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, email: 'ocupado@mg.com' }),
    ).rejects.toThrow(ValidationError)
  })

  it('rejects an invalid email', async () => {
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, email: 'no-es-un-email' }),
    ).rejects.toThrow(ValidationError)
  })

  it('agent cannot edit other agents', async () => {
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, requestingUserRole: 'agent', full_name: 'X' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('an admin cannot edit the owner', async () => {
    mockUserRepo.findById.mockResolvedValue(fakeUser({ role: 'owner' }))
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, password: 'secreto123' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('throws NotFoundError when the agent is not in the org', async () => {
    mockUserRepo.findById.mockResolvedValue(null)
    await expect(
      new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, full_name: 'X' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('preserves role, org and created_at', async () => {
    await new UpdateAgentUseCase(mockUserRepo, mockAuthService).execute({ ...base, full_name: 'X' })
    const saved = savedProps()
    expect(saved.role).toBe('agent')
    expect(saved.org_id).toBe('org_mg')
    expect(saved.created_at).toBe('2026-01-01T00:00:00.000Z')
  })
})
