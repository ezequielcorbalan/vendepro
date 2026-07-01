import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateApiTokenUseCase } from '../../../src/application/use-cases/api-tokens/create-api-token'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockRepo = {
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  revoke: vi.fn(),
  touchLastUsed: vi.fn(),
}

const mockIds = { generate: vi.fn().mockReturnValue('tok-1') }

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ0eXAiOiJpbnRlZ3JhdGlvbiJ9.signaturepart'
const mockAuth = {
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createToken: vi.fn().mockResolvedValue(FAKE_JWT),
  verifyToken: vi.fn(),
}

describe('CreateApiTokenUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.save.mockResolvedValue(undefined)
    mockIds.generate.mockReturnValue('tok-1')
    mockAuth.createToken.mockResolvedValue(FAKE_JWT)
  })

  it('crea el token, lo guarda y devuelve el JWT en claro una vez', async () => {
    const uc = new CreateApiTokenUseCase(mockRepo, mockIds, mockAuth)
    const result = await uc.execute({ orgId: 'org_mg', name: 'Zapier', createdBy: 'user-1' })

    expect(mockRepo.save).toHaveBeenCalledTimes(1)
    expect(result.token).toBe(FAKE_JWT)
    expect(result.id).toBe('tok-1')
    expect(result.scopes).toEqual(['leads:write'])
    // prefix enmascarado, no el token completo
    expect(result.prefix).not.toBe(FAKE_JWT)
    expect(result.prefix).toContain('…')
  })

  it('firma un JWT de integración sin expiración con el tid', async () => {
    const uc = new CreateApiTokenUseCase(mockRepo, mockIds, mockAuth)
    await uc.execute({ orgId: 'org_mg', name: 'Make' })

    expect(mockAuth.createToken).toHaveBeenCalledWith(
      { typ: 'integration', org_id: 'org_mg', tid: 'tok-1', scopes: ['leads:write'] },
      { expiresIn: null },
    )
  })

  it('respeta scopes custom', async () => {
    const uc = new CreateApiTokenUseCase(mockRepo, mockIds, mockAuth)
    const result = await uc.execute({ orgId: 'org_mg', name: 'Custom', scopes: ['leads:write', 'contacts:write'] })
    expect(result.scopes).toEqual(['leads:write', 'contacts:write'])
  })

  it('rechaza nombre vacío', async () => {
    const uc = new CreateApiTokenUseCase(mockRepo, mockIds, mockAuth)
    await expect(uc.execute({ orgId: 'org_mg', name: '' })).rejects.toThrow(ValidationError)
  })
})
