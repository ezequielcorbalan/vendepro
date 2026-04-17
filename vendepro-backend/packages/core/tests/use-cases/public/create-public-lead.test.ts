import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreatePublicLeadUseCase } from '../../../src/application/use-cases/public/create-public-lead'
import { Organization } from '../../../src/domain/entities/organization'
import { User } from '../../../src/domain/entities/user'
import { UnauthorizedError } from '../../../src/domain/errors/unauthorized'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const makeOrg = () =>
  Organization.create({
    id: 'org-1',
    name: 'Test Inmobiliaria',
    slug: 'test-inmobiliaria',
    logo_url: null,
    brand_color: '#ff007c',
    brand_accent_color: null,
    canva_template_id: null,
    canva_report_template_id: null,
    owner_id: null,
  })

const makeAdmin = () =>
  User.create({
    id: 'admin-1',
    email: 'admin@test.com',
    password_hash: 'hashed',
    full_name: 'Admin User',
    phone: null,
    photo_url: null,
    role: 'admin',
    org_id: 'org-1',
    active: 1,
  })

const mockIds = { generate: vi.fn().mockReturnValue('generated-id') }

const makeRepos = (overrides: {
  org?: Organization | null
  admin?: User | null
} = {}) => ({
  organizationRepo: {
    findByApiKey: vi.fn().mockResolvedValue(
      'org' in overrides ? overrides.org : makeOrg()
    ),
  } as any,
  userRepo: {
    findFirstAdminByOrg: vi.fn().mockResolvedValue(
      'admin' in overrides ? overrides.admin : makeAdmin()
    ),
  } as any,
  contactRepo: { save: vi.fn().mockResolvedValue(undefined) } as any,
  leadRepo: { save: vi.fn().mockResolvedValue(undefined) } as any,
})

describe('CreatePublicLeadUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIds.generate.mockReturnValue('generated-id')
  })

  it('creates contact and lead and returns id + contact_id on success', async () => {
    let idCount = 0
    mockIds.generate.mockImplementation(() => `id-${++idCount}`)

    const repos = makeRepos()
    const uc = new CreatePublicLeadUseCase(
      repos.organizationRepo,
      repos.userRepo,
      repos.contactRepo,
      repos.leadRepo,
      mockIds,
    )

    const result = await uc.execute({
      apiKey: 'valid-key',
      full_name: 'María García',
      phone: '+5491187654321',
      email: null,
    })

    expect(result.success).toBe(true)
    expect(result.id).toBeTruthy()
    expect(result.contact_id).toBeTruthy()
    expect(repos.contactRepo.save).toHaveBeenCalledOnce()
    expect(repos.leadRepo.save).toHaveBeenCalledOnce()
  })

  it('throws UnauthorizedError when API key is invalid', async () => {
    const repos = makeRepos({ org: null })
    const uc = new CreatePublicLeadUseCase(
      repos.organizationRepo,
      repos.userRepo,
      repos.contactRepo,
      repos.leadRepo,
      mockIds,
    )

    await expect(
      uc.execute({ apiKey: 'bad-key', full_name: 'Test' }),
    ).rejects.toThrow(UnauthorizedError)

    expect(repos.contactRepo.save).not.toHaveBeenCalled()
    expect(repos.leadRepo.save).not.toHaveBeenCalled()
  })

  it('throws ValidationError when full_name is empty', async () => {
    const repos = makeRepos()
    const uc = new CreatePublicLeadUseCase(
      repos.organizationRepo,
      repos.userRepo,
      repos.contactRepo,
      repos.leadRepo,
      mockIds,
    )

    await expect(
      uc.execute({ apiKey: 'valid-key', full_name: '   ' }),
    ).rejects.toThrow(ValidationError)

    expect(repos.contactRepo.save).not.toHaveBeenCalled()
  })

  it('throws ValidationError when org has no admin', async () => {
    const repos = makeRepos({ admin: null })
    const uc = new CreatePublicLeadUseCase(
      repos.organizationRepo,
      repos.userRepo,
      repos.contactRepo,
      repos.leadRepo,
      mockIds,
    )

    await expect(
      uc.execute({ apiKey: 'valid-key', full_name: 'Test User' }),
    ).rejects.toThrow(ValidationError)

    expect(repos.contactRepo.save).not.toHaveBeenCalled()
  })

  it('assigns lead and contact to the first admin of the org', async () => {
    let idCount = 0
    mockIds.generate.mockImplementation(() => `id-${++idCount}`)

    const repos = makeRepos()
    const uc = new CreatePublicLeadUseCase(
      repos.organizationRepo,
      repos.userRepo,
      repos.contactRepo,
      repos.leadRepo,
      mockIds,
    )

    await uc.execute({ apiKey: 'valid-key', full_name: 'Carlos López', phone: '+5491100000000' })

    expect(repos.userRepo.findFirstAdminByOrg).toHaveBeenCalledWith('org-1')
    const savedContact = repos.contactRepo.save.mock.calls[0][0]
    expect(savedContact.agent_id).toBe('admin-1')
    const savedLead = repos.leadRepo.save.mock.calls[0][0]
    expect(savedLead.assigned_to).toBe('admin-1')
  })
})
