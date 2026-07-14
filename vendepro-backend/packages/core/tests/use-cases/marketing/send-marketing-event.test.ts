import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendMarketingEventUseCase } from '../../../src/application/use-cases/marketing/send-marketing-event'

const idGen = { generate: () => 'id_1' }
const decrypt = vi.fn(async () => 'token-plano')

function makeDeps(integration: any, mapping: any = { meta_event_name: 'Lead', ga4_event_name: null, enabled: true }) {
  return {
    integrations: { findByAgent: vi.fn().mockResolvedValue(integration), save: vi.fn() } as any,
    mappings: { findByOrgAndStage: vi.fn().mockResolvedValue(mapping) } as any,
    logs: { save: vi.fn().mockResolvedValue(undefined) } as any,
    leads: { findById: vi.fn().mockResolvedValue(null) } as any,
    metaApi: { sendEvent: vi.fn().mockResolvedValue({ ok: true, status: 200, body: 'ok' }) } as any,
    ga4Api: { sendEvent: vi.fn() } as any,
  }
}

const enabledIntegration = {
  pixel_id: '123', access_token_encrypted: 'enc', stape_endpoint: null, enabled: true,
  test_event_code: null, ga4_enabled: false, ga4_measurement_id: null, ga4_api_secret_encrypted: null,
}

function build(d: any) {
  return new SendMarketingEventUseCase(
    d.integrations, d.mappings, d.logs, d.leads, d.metaApi, d.ga4Api, idGen, decrypt,
  )
}

describe('SendMarketingEventUseCase — por agente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('noop si no se pasa agentId (config es por-agente)', async () => {
    const d = makeDeps(enabledIntegration)
    const out = await build(d).execute({ orgId: 'org', eventKey: 'lead_created', entityId: 'l1' })
    expect(out.meta.status).toBe('noop')
    expect(out.meta.reason).toBe('no_agent')
    expect(d.integrations.findByAgent).not.toHaveBeenCalled()
  })

  it('noop si el agente no tiene integración configurada', async () => {
    const d = makeDeps(null)
    const out = await build(d).execute({ orgId: 'org', agentId: 'ag1', eventKey: 'lead_created', entityId: 'l1' })
    expect(out.meta.reason).toBe('no_integration')
    expect(d.integrations.findByAgent).toHaveBeenCalledWith('ag1')
  })

  it('resuelve la config del agente y dispara Meta con su pixel', async () => {
    const d = makeDeps(enabledIntegration)
    const out = await build(d).execute({
      orgId: 'org', agentId: 'ag1', eventKey: 'lead_created', entityId: 'l1',
      userData: { email: 'a@b.com' },
    })
    expect(d.integrations.findByAgent).toHaveBeenCalledWith('ag1')
    expect(out.meta.status).toBe('sent')
    expect(d.metaApi.sendEvent).toHaveBeenCalledWith(expect.objectContaining({ pixelId: '123' }))
    // El log queda atribuido al agente.
    const savedLog = d.logs.save.mock.calls[0][0]
    expect(savedLog.agent_id).toBe('ag1')
  })
})
