import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveOrgIntegrationUseCase } from '../../../src/application/use-cases/integrations/save-org-integration'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'

const mockRepo = {
  findByOrgAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  findEnabledByProvider: vi.fn(),
}
const mockIds = { generate: vi.fn().mockReturnValue('integ-1') }
const encrypt = vi.fn(async (plain: string) => `enc(${plain})`)

function existingIntegration(overrides: Record<string, unknown> = {}) {
  return OrgIntegration.create({
    id: 'integ-1',
    org_id: 'org_mg',
    provider: 'kiteprop',
    credentials_encrypted: 'enc(vieja)',
    enabled: false,
    ...overrides,
  })
}

describe('SaveOrgIntegrationUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.findByOrgAndProvider.mockResolvedValue(null)
    mockRepo.save.mockResolvedValue(undefined)
    mockIds.generate.mockReturnValue('integ-1')
  })

  it('crea la integración si no existe y cifra la api key', async () => {
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    const view = await uc.execute({ orgId: 'org_mg', provider: 'kiteprop', api_key: 'kp_nueva', name: 'KiteProp' })

    expect(encrypt).toHaveBeenCalledWith('kp_nueva')
    const saved: OrgIntegration = mockRepo.save.mock.calls[0][0]
    expect(saved.credentials_encrypted).toBe('enc(kp_nueva)')
    expect(saved.provider).toBe('kiteprop')
    // la vista pública nunca expone credenciales
    expect((view as any).credentials_encrypted).toBeUndefined()
    expect(view.has_api_key).toBe(true)
  })

  it("placeholder '********' no pisa la key guardada", async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(existingIntegration())
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    await uc.execute({ orgId: 'org_mg', provider: 'kiteprop', api_key: '********' })

    expect(encrypt).not.toHaveBeenCalled()
    expect(mockRepo.save.mock.calls[0][0].credentials_encrypted).toBe('enc(vieja)')
  })

  it("api_key '' limpia la credencial", async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(existingIntegration())
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    const view = await uc.execute({ orgId: 'org_mg', provider: 'kiteprop', api_key: '' })

    expect(mockRepo.save.mock.calls[0][0].credentials_encrypted).toBeNull()
    expect(view.has_api_key).toBe(false)
  })

  it('al habilitar por primera vez marca last_sync_at (inicio del incremental)', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(existingIntegration({ enabled: false }))
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    await uc.execute({ orgId: 'org_mg', provider: 'kiteprop', enabled: true })

    const saved: OrgIntegration = mockRepo.save.mock.calls[0][0]
    expect(saved.enabled).toBe(true)
    expect(saved.last_sync_at).toBeTruthy()
  })

  it('re-habilitar no pisa un last_sync_at existente', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(
      existingIntegration({ enabled: false, last_sync_at: '2026-06-01T00:00:00.000Z' }),
    )
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    await uc.execute({ orgId: 'org_mg', provider: 'kiteprop', enabled: true })

    expect(mockRepo.save.mock.calls[0][0].last_sync_at).toBe('2026-06-01T00:00:00.000Z')
  })

  it('undefined preserva los valores existentes (PATCH semántico)', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(
      existingIntegration({ enabled: true, name: 'Mi Kite' }),
    )
    const uc = new SaveOrgIntegrationUseCase(mockRepo, mockIds, encrypt)
    await uc.execute({ orgId: 'org_mg', provider: 'kiteprop' })

    const saved: OrgIntegration = mockRepo.save.mock.calls[0][0]
    expect(saved.enabled).toBe(true)
    expect(saved.name).toBe('Mi Kite')
    expect(saved.credentials_encrypted).toBe('enc(vieja)')
  })
})
