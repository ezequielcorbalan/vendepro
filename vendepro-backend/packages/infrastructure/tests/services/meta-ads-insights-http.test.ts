import { describe, it, expect, vi, afterEach } from 'vitest'
import { MetaAdsInsightsHttp } from '../../src/services/meta-ads-insights-http'

const INPUT = { adAccountId: '123456', accessToken: 'tok', since: '2026-07-01', until: '2026-07-06' }

function stubFetch(status: number, body: any) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('MetaAdsInsightsHttp', () => {
  it('arma la URL con act_ prefix, level=campaign y time_range', async () => {
    const fn = stubFetch(200, { data: [] })
    await new MetaAdsInsightsHttp().getCampaignInsights(INPUT)

    const url = new URL(fn.mock.calls[0][0] as string)
    expect(url.pathname).toBe('/v17.0/act_123456/insights')
    expect(url.searchParams.get('level')).toBe('campaign')
    expect(url.searchParams.get('access_token')).toBe('tok')
    expect(JSON.parse(url.searchParams.get('time_range')!)).toEqual({ since: '2026-07-01', until: '2026-07-06' })
  })

  it('no duplica el prefijo act_ si ya viene incluido', async () => {
    const fn = stubFetch(200, { data: [] })
    await new MetaAdsInsightsHttp().getCampaignInsights({ ...INPUT, adAccountId: 'act_777' })
    expect(fn.mock.calls[0][0]).toContain('/act_777/insights')
  })

  it('parsea campañas y toma el máximo de las variantes de lead (dedup)', async () => {
    stubFetch(200, {
      data: [{
        campaign_id: '1', campaign_name: 'Palermo', spend: '100.50',
        impressions: '5000', clicks: '200', account_currency: 'ARS',
        actions: [
          { action_type: 'lead', value: '10' },
          { action_type: 'onsite_conversion.lead_grouped', value: '7' },
          { action_type: 'link_click', value: '180' },
        ],
      }],
    })
    const res = await new MetaAdsInsightsHttp().getCampaignInsights(INPUT)
    expect(res.ok).toBe(true)
    expect(res.campaigns).toEqual([{
      campaign_id: '1', campaign_name: 'Palermo', spend: 100.5,
      impressions: 5000, clicks: 200, leads: 10, account_currency: 'ARS',
    }])
  })

  it('devuelve el mensaje de error de Meta en fallos HTTP', async () => {
    stubFetch(403, { error: { message: '(#200) Requires ads_read permission' } })
    const res = await new MetaAdsInsightsHttp().getCampaignInsights(INPUT)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
    expect(res.error).toContain('ads_read')
  })

  it('tolera errores de red sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    const res = await new MetaAdsInsightsHttp().getCampaignInsights(INPUT)
    expect(res.ok).toBe(false)
    expect(res.error).toBe('boom')
  })
})
