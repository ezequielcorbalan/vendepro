import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CompletePasswordResetUseCase } from '../../../src/application/use-cases/auth/complete-password-reset'
import { User } from '../../../src/domain/entities/user'
import { PasswordResetToken } from '../../../src/domain/entities/password-reset-token'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const buildUser = () =>
  User.create({
    id: 'user-1',
    email: 'agent@mg.com',
    password_hash: 'old_hash',
    full_name: 'Test Agent',
    phone: null,
    photo_url: null,
    role: 'agent',
    org_id: 'org_mg',
    active: 1,
  })

const TOKEN_STR = 'a'.repeat(64)

const buildToken = (overrides: Partial<Parameters<typeof PasswordResetToken.create>[0]> = {}) =>
  PasswordResetToken.create({
    token: TOKEN_STR,
    user_id: 'user-1',
    org_id: 'org_mg',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    used: false,
    ...overrides,
  })

const makeUserRepo = () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn(),
  findFirstAdminByOrg: vi.fn(),
  findProfileById: vi.fn(),
  updateProfile: vi.fn(),
})

const makeTokenRepo = () => ({
  save: vi.fn(),
  findByToken: vi.fn(),
  markUsed: vi.fn().mockResolvedValue(undefined),
  deleteExpired: vi.fn(),
})

const makeAuthService = () => ({
  hashPassword: vi.fn().mockResolvedValue('new_hash'),
  verifyPassword: vi.fn(),
  createToken: vi.fn(),
  verifyToken: vi.fn(),
})

describe('CompletePasswordResetUseCase', () => {
  let userRepo: ReturnType<typeof makeUserRepo>
  let tokenRepo: ReturnType<typeof makeTokenRepo>
  let authService: ReturnType<typeof makeAuthService>

  beforeEach(() => {
    userRepo = makeUserRepo()
    tokenRepo = makeTokenRepo()
    authService = makeAuthService()
  })

  it('updates the user password and marks the token used on valid input', async () => {
    tokenRepo.findByToken.mockResolvedValue(buildToken())
    const user = buildUser()
    userRepo.findById.mockResolvedValue(user)

    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await useCase.execute({ token: TOKEN_STR, newPassword: 'newpass123' })

    expect(authService.hashPassword).toHaveBeenCalledWith('newpass123')
    expect(user.password_hash).toBe('new_hash')
    expect(userRepo.save).toHaveBeenCalledWith(user)
    expect(tokenRepo.markUsed).toHaveBeenCalledWith(TOKEN_STR)
  })

  it('throws ValidationError when the new password is shorter than 8 chars', async () => {
    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await expect(useCase.execute({ token: TOKEN_STR, newPassword: 'short' }))
      .rejects.toThrow(ValidationError)

    expect(tokenRepo.findByToken).not.toHaveBeenCalled()
    expect(userRepo.save).not.toHaveBeenCalled()
    expect(tokenRepo.markUsed).not.toHaveBeenCalled()
  })

  it('throws ValidationError when the token is not found', async () => {
    tokenRepo.findByToken.mockResolvedValue(null)

    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await expect(useCase.execute({ token: TOKEN_STR, newPassword: 'newpass123' }))
      .rejects.toThrow(ValidationError)

    expect(userRepo.save).not.toHaveBeenCalled()
    expect(tokenRepo.markUsed).not.toHaveBeenCalled()
  })

  it('throws ValidationError when the token is expired', async () => {
    const expired = buildToken({
      expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    })
    tokenRepo.findByToken.mockResolvedValue(expired)

    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await expect(useCase.execute({ token: TOKEN_STR, newPassword: 'newpass123' }))
      .rejects.toThrow(ValidationError)

    expect(userRepo.save).not.toHaveBeenCalled()
    expect(tokenRepo.markUsed).not.toHaveBeenCalled()
  })

  it('throws ValidationError when the token has already been used', async () => {
    const used = buildToken({ used: true })
    tokenRepo.findByToken.mockResolvedValue(used)

    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await expect(useCase.execute({ token: TOKEN_STR, newPassword: 'newpass123' }))
      .rejects.toThrow(ValidationError)

    expect(userRepo.save).not.toHaveBeenCalled()
    expect(tokenRepo.markUsed).not.toHaveBeenCalled()
  })

  it('throws ValidationError when the user no longer exists', async () => {
    tokenRepo.findByToken.mockResolvedValue(buildToken())
    userRepo.findById.mockResolvedValue(null)

    const useCase = new CompletePasswordResetUseCase(tokenRepo, userRepo, authService)
    await expect(useCase.execute({ token: TOKEN_STR, newPassword: 'newpass123' }))
      .rejects.toThrow(ValidationError)

    expect(userRepo.save).not.toHaveBeenCalled()
    expect(tokenRepo.markUsed).not.toHaveBeenCalled()
  })
})
