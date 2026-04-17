import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetOrgSettingsUseCase } from '../../../src/application/use-cases/admin/get-org-settings'
import { Organization } from '../../../src/domain/entities/organization'

const mockOrg = Organization.create({
  id: 'org_mg',
  name: 'Marcela Genta',
  slug: 'marcela-genta',
  logo_url: null,
  brand_color: '#ff007c',
  brand_accent_color: null,
  canva_template_id: null,
  canva_report_template_id: null,
  owner_id: 'user-1',
})

const mockRepo = {
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByApiKey: vi.fn(),
  save: vi.fn(),
  updateSettings: vi.fn(),
  setApiKey: vi.fn(),
  getApiKey: vi.fn(),
}

describe('GetOrgSettingsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns organization when found', async () => {
    mockRepo.findById.mockResolvedValue(mockOrg)
    const useCase = new GetOrgSettingsUseCase(mockRepo)
    const result = await useCase.execute('org_mg')
    expect(result).toBe(mockOrg)
    expect(mockRepo.findById).toHaveBeenCalledWith('org_mg')
  })

  it('returns null when organization not found', async () => {
    mockRepo.findById.mockResolvedValue(null)
    const useCase = new GetOrgSettingsUseCase(mockRepo)
    const result = await useCase.execute('nonexistent')
    expect(result).toBeNull()
  })
})
