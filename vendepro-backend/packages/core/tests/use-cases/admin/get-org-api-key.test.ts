import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetOrgApiKeyUseCase } from '../../../src/application/use-cases/admin/get-org-api-key'

const mockRepo = {
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByApiKey: vi.fn(),
  save: vi.fn(),
  updateSettings: vi.fn(),
  setApiKey: vi.fn(),
  getApiKey: vi.fn(),
}

describe('GetOrgApiKeyUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns has_key false and null masked key when no key is set', async () => {
    mockRepo.getApiKey.mockResolvedValue(null)
    const useCase = new GetOrgApiKeyUseCase(mockRepo)
    const result = await useCase.execute('org_mg')

    expect(result).toEqual({ has_key: false, api_key_masked: null })
  })

  it('returns has_key true with masked key when key is set', async () => {
    mockRepo.getApiKey.mockResolvedValue('vp_live_abcdef1234567890abcdef1234567890')
    const useCase = new GetOrgApiKeyUseCase(mockRepo)
    const result = await useCase.execute('org_mg')

    expect(result.has_key).toBe(true)
    expect(result.api_key_masked).toContain('••••••••••••')
    expect(result.api_key_masked).not.toBeNull()
  })

  it('masked key preserves the last 4 characters of the original key', async () => {
    mockRepo.getApiKey.mockResolvedValue('vp_live_abcdef1234567890abcdef12345678')
    const useCase = new GetOrgApiKeyUseCase(mockRepo)
    const result = await useCase.execute('org_mg')

    expect(result.api_key_masked).toMatch(/5678$/)
  })
})
