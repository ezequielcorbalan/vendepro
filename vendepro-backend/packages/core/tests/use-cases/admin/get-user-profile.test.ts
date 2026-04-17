import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetUserProfileUseCase } from '../../../src/application/use-cases/admin/get-user-profile'
import { User } from '../../../src/domain/entities/user'

const mockUser = User.create({
  id: 'user-1',
  email: 'marcela@mg.com',
  password_hash: 'hashed',
  full_name: 'Marcela Genta',
  phone: '+54911234567',
  photo_url: null,
  role: 'owner',
  org_id: 'org_mg',
  active: 1,
})

const mockRepo = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  updateRole: vi.fn(),
  findFirstAdminByOrg: vi.fn(),
  findProfileById: vi.fn(),
  updateProfile: vi.fn(),
}

describe('GetUserProfileUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user profile when found', async () => {
    mockRepo.findProfileById.mockResolvedValue(mockUser)
    const useCase = new GetUserProfileUseCase(mockRepo)
    const result = await useCase.execute('user-1')
    expect(result).toBe(mockUser)
    expect(mockRepo.findProfileById).toHaveBeenCalledWith('user-1')
  })

  it('returns null when user not found', async () => {
    mockRepo.findProfileById.mockResolvedValue(null)
    const useCase = new GetUserProfileUseCase(mockRepo)
    const result = await useCase.execute('nonexistent')
    expect(result).toBeNull()
  })
})
