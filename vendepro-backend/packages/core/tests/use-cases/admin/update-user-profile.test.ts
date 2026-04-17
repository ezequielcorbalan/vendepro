import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateUserProfileUseCase } from '../../../src/application/use-cases/admin/update-user-profile'

const mockRepo = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  updateRole: vi.fn(),
  findFirstAdminByOrg: vi.fn(),
  findProfileById: vi.fn(),
  updateProfile: vi.fn().mockResolvedValue(undefined),
}

describe('UpdateUserProfileUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.updateProfile.mockResolvedValue(undefined)
  })

  it('calls repo.updateProfile with patch (excluding userId)', async () => {
    const useCase = new UpdateUserProfileUseCase(mockRepo)
    await useCase.execute({
      userId: 'user-1',
      full_name: 'Marcela Genta',
      phone: '+54911234567',
      photo_url: null,
    })
    expect(mockRepo.updateProfile).toHaveBeenCalledWith('user-1', {
      full_name: 'Marcela Genta',
      phone: '+54911234567',
      photo_url: null,
    })
  })

  it('handles undefined optional fields gracefully', async () => {
    const useCase = new UpdateUserProfileUseCase(mockRepo)
    await useCase.execute({ userId: 'user-2' })
    expect(mockRepo.updateProfile).toHaveBeenCalledWith('user-2', {})
  })
})
