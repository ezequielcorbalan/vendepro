import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerateOrgApiKeyUseCase } from '../../../src/application/use-cases/admin/generate-org-api-key'

const mockRepo = {
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByApiKey: vi.fn(),
  save: vi.fn(),
  updateSettings: vi.fn(),
  setApiKey: vi.fn().mockResolvedValue(undefined),
  getApiKey: vi.fn(),
}

describe('GenerateOrgApiKeyUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.setApiKey.mockResolvedValue(undefined)
  })

  it('generates a key with vp_live_ prefix and 32 hex chars', async () => {
    const useCase = new GenerateOrgApiKeyUseCase(mockRepo)
    const result = await useCase.execute('org_mg')

    expect(result.api_key).toMatch(/^vp_live_[0-9a-f]{32}$/)
  })

  it('calls setApiKey with the generated key and orgId', async () => {
    const useCase = new GenerateOrgApiKeyUseCase(mockRepo)
    const result = await useCase.execute('org_mg')

    expect(mockRepo.setApiKey).toHaveBeenCalledTimes(1)
    expect(mockRepo.setApiKey).toHaveBeenCalledWith('org_mg', result.api_key)
  })
})
