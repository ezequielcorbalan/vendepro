import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetCampaignInsightsUseCase } from '../../../src/application/use-cases/marketing/get-campaign-insights'

const CAMPAIGN = {
  campaign_id: '123',
  campaign_name: 'Captación Palermo',
  spend: 150.5,
  impressions: 10000,
  clicks: 320,
  leads: 12,
  account_currency: 'ARS',
}

function makeRepo(integration: any) {
  return { findByOrg: vi.fn().mockResolvedValue(integration), save: vi.fn() } as any
}

function makeInsights(result: any) {
  return { getCampaignInsights: vi.fn().mockResolvedValue(result) } as any
}

const decryptOk = vi.fn(async () => 'token-plano')
const decryptFail = vi.fn(async () => null)

const configured = {
  enabled: true,
  access_token_encrypted: 'enc(token)',
  ad_account_id: 'act_999',
}

describe('GetCampaignInsightsUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('not_configured si no hay integración guardada', async () => {
    const uc = new GetCampaignInsightsUseCase(makeRepo(null), makeInsights(null), decryptOk)
    const out = await uc.execute({ orgId: 'org', since: '2026-07-01', until: '2026-07-06' })
    expect(out).toEqual({ status: 'not_configured', campaigns: [] })
  })

  it('not_configured si la integración está deshabilitada o sin token', async () => {
    const uc1 = new GetCampaignInsightsUseCase(
      makeRepo({ ...configured, enabled: false }), makeInsights(null), decryptOk)
    expect((await uc1.execute({ orgId: 'org', since: 'a', until: 'b' })).status).toBe('not_configured')

    const uc2 = new GetCampaignInsightsUseCase(
      makeRepo({ ...configured, access_token_encrypted: null }), makeInsights(null), decryptOk)
    expect((await uc2.execute({ orgId: 'org', since: 'a', until: 'b' })).status).toBe('not_configured')
  })

  it('missing_ad_account si falta el ad_account_id', async () => {
    const uc = new GetCampaignInsightsUseCase(
      makeRepo({ ...configured, ad_account_id: null }), makeInsights(null), decryptOk)
    const out = await uc.execute({ orgId: 'org', since: 'a', until: 'b' })
    expect(out.status).toBe('missing_ad_account')
  })

  it('token_error si el token no se puede desencriptar', async () => {
    const uc = new GetCampaignInsightsUseCase(makeRepo(configured), makeInsights(null), decryptFail)
    const out = await uc.execute({ orgId: 'org', since: 'a', until: 'b' })
    expect(out.status).toBe('token_error')
  })

  it('api_error propaga el mensaje de Meta (ej. falta ads_read)', async () => {
    const insights = makeInsights({ ok: false, status: 403, campaigns: [], error: '(#200) ads_read permission required' })
    const uc = new GetCampaignInsightsUseCase(makeRepo(configured), insights, decryptOk)
    const out = await uc.execute({ orgId: 'org', since: 'a', until: 'b' })
    expect(out.status).toBe('api_error')
    expect(out.error).toContain('ads_read')
  })

  it('ok devuelve las campañas y pasa el token desencriptado + rango', async () => {
    const insights = makeInsights({ ok: true, status: 200, campaigns: [CAMPAIGN] })
    const uc = new GetCampaignInsightsUseCase(makeRepo(configured), insights, decryptOk)
    const out = await uc.execute({ orgId: 'org', since: '2026-07-01', until: '2026-07-06' })
    expect(out.status).toBe('ok')
    expect(out.campaigns).toEqual([CAMPAIGN])
    expect(insights.getCampaignInsights).toHaveBeenCalledWith({
      adAccountId: 'act_999',
      accessToken: 'token-plano',
      since: '2026-07-01',
      until: '2026-07-06',
    })
  })
})
