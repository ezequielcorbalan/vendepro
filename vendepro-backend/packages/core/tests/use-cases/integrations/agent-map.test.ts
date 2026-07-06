import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveAgentMapUseCase } from '../../../src/application/use-cases/integrations/save-agent-map'
import { GetKitepropAgentsUseCase } from '../../../src/application/use-cases/integrations/get-kiteprop-agents'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'

const mockRepo = {
  findByOrgAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  findEnabledByProvider: vi.fn(),
}

function integration(overrides: Record<string, unknown> = {}) {
  return OrgIntegration.create({
    id: 'i1', org_id: 'org_mg', provider: 'kiteprop',
    credentials_encrypted: 'enc(kp)', enabled: true, ...overrides,
  })
}

describe('SaveAgentMapUseCase', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRepo.save.mockResolvedValue(undefined) })

  it('guarda el mapeo en config_json y descarta entradas vacías', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(integration())
    const uc = new SaveAgentMapUseCase(mockRepo)
    const res = await uc.execute({ orgId: 'org_mg', map: { '7673': 'user-marcela', '7688': '', '7691': '  ' } })

    expect(res.ok).toBe(true)
    expect(res.map).toEqual({ '7673': 'user-marcela' })
    const saved: OrgIntegration = mockRepo.save.mock.calls[0][0]
    expect(saved.getConfig().agent_map).toEqual({ '7673': 'user-marcela' })
  })

  it('preserva otras claves de config al guardar el mapeo', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(integration({ config_json: JSON.stringify({ backfill_next_page: 5 }) }))
    const uc = new SaveAgentMapUseCase(mockRepo)
    await uc.execute({ orgId: 'org_mg', map: { '7673': 'u1' } })
    const cfg = (mockRepo.save.mock.calls[0][0] as OrgIntegration).getConfig()
    expect(cfg.backfill_next_page).toBe(5)
    expect(cfg.agent_map).toEqual({ '7673': 'u1' })
  })

  it('ok:false si no existe la integración', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(null)
    const res = await new SaveAgentMapUseCase(mockRepo).execute({ orgId: 'org_mg', map: {} })
    expect(res.ok).toBe(false)
    expect(mockRepo.save).not.toHaveBeenCalled()
  })
})

describe('GetKitepropAgentsUseCase', () => {
  const mockGateway = { testConnection: vi.fn(), fetchContacts: vi.fn(), fetchMessages: vi.fn(), getPropertyRef: vi.fn(), fetchAgents: vi.fn(), getContactAgent: vi.fn() }
  const decrypt = vi.fn(async () => 'kp_key')

  beforeEach(() => { vi.clearAllMocks(); decrypt.mockResolvedValue('kp_key') })

  it('devuelve agentes de KiteProp + el mapeo guardado', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(integration({ config_json: JSON.stringify({ agent_map: { '7673': 'user-marcela' } }) }))
    mockGateway.fetchAgents.mockResolvedValue([{ external_id: '7673', full_name: 'Marcela Genta', email: 'm@dein.com' }])

    const res = await new GetKitepropAgentsUseCase(mockRepo, mockGateway, decrypt).execute('org_mg')
    expect(res.kiteprop).toHaveLength(1)
    expect(res.map).toEqual({ '7673': 'user-marcela' })
  })

  it('error si no hay API key configurada', async () => {
    mockRepo.findByOrgAndProvider.mockResolvedValue(integration({ credentials_encrypted: null }))
    const res = await new GetKitepropAgentsUseCase(mockRepo, mockGateway, decrypt).execute('org_mg')
    expect(res.error).toContain('API key')
    expect(mockGateway.fetchAgents).not.toHaveBeenCalled()
  })
})
