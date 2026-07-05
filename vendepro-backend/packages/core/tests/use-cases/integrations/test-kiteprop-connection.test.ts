import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TestKitepropConnectionUseCase } from '../../../src/application/use-cases/integrations/test-kiteprop-connection'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'

const mockRepo = {
  findByOrgAndProvider: vi.fn(),
  save: vi.fn(),
  findEnabledByProvider: vi.fn(),
}
const mockGateway = {
  testConnection: vi.fn().mockResolvedValue({ ok: true, profileName: 'Gaston' }),
  fetchContacts: vi.fn(),
}

describe('TestKitepropConnectionUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGateway.testConnection.mockResolvedValue({ ok: true, profileName: 'Gaston' })
  })

  it('prueba la key del body si viene (sin tocar el repo)', async () => {
    const uc = new TestKitepropConnectionUseCase(mockRepo, mockGateway, async () => null)
    const result = await uc.execute({ orgId: 'org_mg', api_key: 'kp_delbody' })

    expect(result).toEqual({ ok: true, profileName: 'Gaston' })
    expect(mockGateway.testConnection).toHaveBeenCalledWith('kp_delbody')
    expect(mockRepo.findByOrgAndProvider).not.toHaveBeenCalled()
  })

  it('sin key en el body usa la guardada desencriptada', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(OrgIntegration.create({
      id: 'i1', org_id: 'org_mg', provider: 'kiteprop', credentials_encrypted: 'enc(kp_guardada)',
    }))
    const decrypt = vi.fn(async () => 'kp_guardada')
    const uc = new TestKitepropConnectionUseCase(mockRepo, mockGateway, decrypt)
    const result = await uc.execute({ orgId: 'org_mg' })

    expect(decrypt).toHaveBeenCalledWith('enc(kp_guardada)')
    expect(mockGateway.testConnection).toHaveBeenCalledWith('kp_guardada')
    expect(result.ok).toBe(true)
  })

  it('sin key configurada devuelve error sin llamar al gateway', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(null)
    const uc = new TestKitepropConnectionUseCase(mockRepo, mockGateway, async () => null)
    const result = await uc.execute({ orgId: 'org_mg' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('No hay API key')
    expect(mockGateway.testConnection).not.toHaveBeenCalled()
  })

  it('decrypt null (JWT_SECRET rotado) devuelve error claro', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(OrgIntegration.create({
      id: 'i1', org_id: 'org_mg', provider: 'kiteprop', credentials_encrypted: 'enc(x)',
    }))
    const uc = new TestKitepropConnectionUseCase(mockRepo, mockGateway, async () => null)
    const result = await uc.execute({ orgId: 'org_mg' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('desencriptar')
  })
})
