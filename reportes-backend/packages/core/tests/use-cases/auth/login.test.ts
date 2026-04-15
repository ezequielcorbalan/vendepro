import { describe, it, expect, vi } from 'vitest'
import { LoginUseCase } from '../../../src/application/use-cases/auth/login'
import { User } from '../../../src/domain/entities/user'
import { UnauthorizedError } from '../../../src/domain/errors/unauthorized'

const mockUser = User.create({
  id: 'user-1',
  email: 'agent@mg.com',
  password_hash: 'hashed_pass',
  full_name: 'Test Agent',
  phone: null,
  photo_url: null,
  role: 'agent',
  org_id: 'org_mg',
  active: 1,
})

const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
}

const mockAuthService = {
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  createToken: vi.fn(),
  verifyToken: vi.fn(),
}

describe('LoginUseCase', () => {
  it('returns token and user info on valid credentials', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    mockAuthService.verifyPassword.mockResolvedValue(true)
    mockAuthService.createToken.mockResolvedValue('jwt-token')

    const useCase = new LoginUseCase(mockUserRepo, mockAuthService)
    const result = await useCase.execute({ email: 'agent@mg.com', password: 'pass123' })

    expect(result.token).toBe('jwt-token')
    expect(result.user.email).toBe('agent@mg.com')
    expect(result.user.role).toBe('agent')
  })

  it('throws UnauthorizedError when user not found', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(null)

    const useCase = new LoginUseCase(mockUserRepo, mockAuthService)
    await expect(useCase.execute({ email: 'nobody@mg.com', password: 'pass' }))
      .rejects.toThrow(UnauthorizedError)
  })

  it('throws UnauthorizedError on wrong password', async () => {
    mockUserRepo.findByEmail.mockResolvedValue(mockUser)
    mockAuthService.verifyPassword.mockResolvedValue(false)

    const useCase = new LoginUseCase(mockUserRepo, mockAuthService)
    await expect(useCase.execute({ email: 'agent@mg.com', password: 'wrong' }))
      .rejects.toThrow(UnauthorizedError)
  })
})
