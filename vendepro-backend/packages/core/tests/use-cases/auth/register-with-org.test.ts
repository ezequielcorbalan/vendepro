import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RegisterWithOrgUseCase } from '../../../src/application/use-cases/auth/register-with-org'
import { ConflictError } from '../../../src/domain/errors/conflict-error'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const mockOrgRepo = {
  findBySlug: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
}
const mockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
  updateRole: vi.fn().mockResolvedValue(undefined),
}
const mockAuthService = {
  hashPassword: vi.fn().mockResolvedValue('hashed_pass'),
  verifyPassword: vi.fn(),
  createToken: vi.fn().mockResolvedValue('jwt-token'),
  verifyToken: vi.fn(),
}
const mockIdGen = {
  generate: vi.fn()
    .mockReturnValueOnce('aabbccdd11223344aabbccdd11223344') // org id
    .mockReturnValueOnce('eeff00112233445566778899aabbccdd'), // user id
}

const validInput = {
  org_name: 'Genta Inmobiliaria',
  org_slug: 'genta-inmobiliaria',
  admin_name: 'Marcela Genta',
  email: 'marcela@genta.com',
  password: 'password123',
  logo_url: null,
  brand_color: '#ff007c',
}

describe('RegisterWithOrgUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrgRepo.findBySlug.mockResolvedValue(null)
    mockUserRepo.findByEmail.mockResolvedValue(null)
    mockIdGen.generate
      .mockReturnValueOnce('aabbccdd11223344aabbccdd11223344')
      .mockReturnValueOnce('eeff00112233445566778899aabbccdd')
  })

  it('crea org y admin, retorna token y datos', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    const result = await useCase.execute(validInput)

    expect(result.token).toBe('jwt-token')
    expect(result.user.email).toBe('marcela@genta.com')
    expect(result.user.role).toBe('admin')
    expect(result.org.slug).toBe('genta-inmobiliaria')
    expect(mockOrgRepo.save).toHaveBeenCalledOnce()
    expect(mockUserRepo.save).toHaveBeenCalledOnce()
  })

  it('lanza ConflictError si el slug ya existe', async () => {
    mockOrgRepo.findBySlug.mockResolvedValue({ id: 'existing-org' })

    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })

  it('lanza ConflictError si el email ya existe', async () => {
    mockUserRepo.findByEmail.mockResolvedValue({ id: 'existing-user' })

    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictError)
  })

  it('sanitiza el slug a solo a-z 0-9 guiones', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    const result = await useCase.execute({ ...validInput, org_slug: 'Genta & Asoc!!' })

    expect(result.org.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('lanza ValidationError si la contraseña tiene menos de 8 caracteres', async () => {
    const useCase = new RegisterWithOrgUseCase(mockOrgRepo, mockUserRepo, mockAuthService, mockIdGen)
    await expect(useCase.execute({ ...validInput, password: 'short' })).rejects.toThrow(ValidationError)
  })
})
