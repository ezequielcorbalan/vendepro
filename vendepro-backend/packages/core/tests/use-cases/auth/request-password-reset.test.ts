import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestPasswordResetUseCase } from '../../../src/application/use-cases/auth/request-password-reset'
import { User } from '../../../src/domain/entities/user'

const buildUser = () =>
  User.create({
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

const makeUserRepo = () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  updateRole: vi.fn(),
  findFirstAdminByOrg: vi.fn(),
  findProfileById: vi.fn(),
  updateProfile: vi.fn(),
})

const makeTokenRepo = () => ({
  save: vi.fn().mockResolvedValue(undefined),
  findByToken: vi.fn(),
  markUsed: vi.fn(),
  deleteExpired: vi.fn(),
})

const makeEmailService = () => ({
  send: vi.fn().mockResolvedValue(undefined),
})

const makeIdGen = () => ({
  // 32-char hex per call; the use-case concatenates two → 64 chars total
  generate: vi.fn().mockReturnValueOnce('a'.repeat(32)).mockReturnValueOnce('b'.repeat(32)),
})

const baseInput = {
  email: 'agent@mg.com',
  appBaseUrl: 'https://app.vendepro.com.ar',
  fromEmail: 'noreply@vendepro.com.ar',
  fromName: 'VendéPro CRM',
}

describe('RequestPasswordResetUseCase', () => {
  let userRepo: ReturnType<typeof makeUserRepo>
  let tokenRepo: ReturnType<typeof makeTokenRepo>
  let emailService: ReturnType<typeof makeEmailService>
  let idGen: ReturnType<typeof makeIdGen>

  beforeEach(() => {
    userRepo = makeUserRepo()
    tokenRepo = makeTokenRepo()
    emailService = makeEmailService()
    idGen = makeIdGen()
  })

  it('saves a token and sends an email with the reset link when user is found', async () => {
    userRepo.findByEmail.mockResolvedValue(buildUser())

    const useCase = new RequestPasswordResetUseCase(userRepo, tokenRepo, emailService, idGen)
    await useCase.execute(baseInput)

    expect(userRepo.findByEmail).toHaveBeenCalledWith('agent@mg.com')
    expect(tokenRepo.save).toHaveBeenCalledTimes(1)

    const savedToken = tokenRepo.save.mock.calls[0][0]
    expect(savedToken.token).toBe('a'.repeat(32) + 'b'.repeat(32))
    expect(savedToken.token.length).toBe(64)
    expect(savedToken.user_id).toBe('user-1')
    expect(savedToken.org_id).toBe('org_mg')
    expect(savedToken.used).toBe(false)

    expect(emailService.send).toHaveBeenCalledTimes(1)
    const emailPayload = emailService.send.mock.calls[0][0]
    expect(emailPayload.subject).toContain('contraseña')
    expect(emailPayload.to).toEqual({ email: 'agent@mg.com', name: 'Test Agent' })
    expect(emailPayload.from).toEqual({ email: 'noreply@vendepro.com.ar', name: 'VendéPro CRM' })
    expect(emailPayload.html).toContain('a'.repeat(32) + 'b'.repeat(32))
    expect(emailPayload.html).toContain('https://app.vendepro.com.ar/reset-password?token=')
    expect(emailPayload.text).toContain('https://app.vendepro.com.ar/reset-password?token=')
  })

  it('returns silently when user is not found — no token saved, no email sent', async () => {
    userRepo.findByEmail.mockResolvedValue(null)

    const useCase = new RequestPasswordResetUseCase(userRepo, tokenRepo, emailService, idGen)
    await expect(useCase.execute(baseInput)).resolves.toBeUndefined()

    expect(tokenRepo.save).not.toHaveBeenCalled()
    expect(emailService.send).not.toHaveBeenCalled()
  })

  it('propagates errors when the email service fails', async () => {
    userRepo.findByEmail.mockResolvedValue(buildUser())
    emailService.send.mockRejectedValue(new Error('emBlue send failed: 500'))

    const useCase = new RequestPasswordResetUseCase(userRepo, tokenRepo, emailService, idGen)
    await expect(useCase.execute(baseInput)).rejects.toThrow('emBlue send failed: 500')

    // Token was persisted before the email attempt
    expect(tokenRepo.save).toHaveBeenCalledTimes(1)
  })

  it('lowercases and trims the email before lookup', async () => {
    userRepo.findByEmail.mockResolvedValue(null)

    const useCase = new RequestPasswordResetUseCase(userRepo, tokenRepo, emailService, idGen)
    await useCase.execute({ ...baseInput, email: '  AGENT@MG.com  ' })

    expect(userRepo.findByEmail).toHaveBeenCalledWith('agent@mg.com')
  })
})
