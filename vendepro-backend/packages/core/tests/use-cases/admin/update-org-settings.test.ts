import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateOrgSettingsUseCase } from '../../../src/application/use-cases/admin/update-org-settings'
import { ConflictError } from '../../../src/domain/errors/conflict-error'

const mockRepo = {
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByApiKey: vi.fn(),
  save: vi.fn(),
  updateSettings: vi.fn(),
  setApiKey: vi.fn(),
  getApiKey: vi.fn(),
}

describe('UpdateOrgSettingsUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls repo.updateSettings with correct args on success', async () => {
    mockRepo.updateSettings.mockResolvedValue(undefined)
    const useCase = new UpdateOrgSettingsUseCase(mockRepo)
    await useCase.execute({
      orgId: 'org_mg',
      patch: { name: 'Nuevo Nombre', slug: 'nuevo-slug' },
    })
    expect(mockRepo.updateSettings).toHaveBeenCalledWith('org_mg', { name: 'Nuevo Nombre', slug: 'nuevo-slug' })
  })

  it('throws ConflictError when slug is already in use', async () => {
    mockRepo.updateSettings.mockRejectedValue(new Error('slug already in use'))
    const useCase = new UpdateOrgSettingsUseCase(mockRepo)
    await expect(useCase.execute({
      orgId: 'org_mg',
      patch: { slug: 'taken-slug' },
    })).rejects.toThrow(ConflictError)
  })

  it('re-throws other errors unchanged', async () => {
    const originalError = new Error('Database connection failed')
    mockRepo.updateSettings.mockRejectedValue(originalError)
    const useCase = new UpdateOrgSettingsUseCase(mockRepo)
    await expect(useCase.execute({
      orgId: 'org_mg',
      patch: { name: 'Test' },
    })).rejects.toThrow('Database connection failed')
  })
})
