import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListApiTokensUseCase } from '../../../src/application/use-cases/api-tokens/list-api-tokens'
import { RevokeApiTokenUseCase } from '../../../src/application/use-cases/api-tokens/revoke-api-token'
import { DeleteApiTokenUseCase } from '../../../src/application/use-cases/api-tokens/delete-api-token'
import { ApiToken } from '../../../src/domain/entities/api-token'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockRepo = {
  save: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  revoke: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  touchLastUsed: vi.fn(),
}

describe('ListApiTokensUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve metadata (sin token) de los tokens de la org', async () => {
    const token = ApiToken.create({
      id: 'tok-1', org_id: 'org_mg', name: 'Zapier', scopes: ['leads:write'],
      prefix: 'eyJhbGciOi…part', created_by: 'user-1', is_active: true,
      last_used_at: null, revoked_at: null,
    })
    mockRepo.findByOrg.mockResolvedValue([token])

    const uc = new ListApiTokensUseCase(mockRepo)
    const result = await uc.execute('org_mg')

    expect(mockRepo.findByOrg).toHaveBeenCalledWith('org_mg')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Zapier')
    expect(result[0].prefix).toBe('eyJhbGciOi…part')
    expect(result[0]).not.toHaveProperty('token')
  })
})

describe('RevokeApiTokenUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.revoke.mockResolvedValue(undefined)
  })

  it('revoca por id + orgId', async () => {
    const uc = new RevokeApiTokenUseCase(mockRepo)
    const result = await uc.execute({ id: 'tok-1', orgId: 'org_mg' })
    expect(mockRepo.revoke).toHaveBeenCalledWith('tok-1', 'org_mg')
    expect(result).toEqual({ success: true })
  })

  it('rechaza id vacío', async () => {
    const uc = new RevokeApiTokenUseCase(mockRepo)
    await expect(uc.execute({ id: '', orgId: 'org_mg' })).rejects.toThrow(ValidationError)
  })
})

describe('DeleteApiTokenUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.delete.mockResolvedValue(undefined)
  })

  it('elimina definitivamente por id + orgId', async () => {
    const uc = new DeleteApiTokenUseCase(mockRepo)
    const result = await uc.execute({ id: 'tok-1', orgId: 'org_mg' })
    expect(mockRepo.delete).toHaveBeenCalledWith('tok-1', 'org_mg')
    expect(result).toEqual({ success: true })
  })

  it('rechaza id vacío', async () => {
    const uc = new DeleteApiTokenUseCase(mockRepo)
    await expect(uc.execute({ id: '', orgId: 'org_mg' })).rejects.toThrow(ValidationError)
  })
})
