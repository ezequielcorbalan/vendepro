import type {
  MetaAdsInsightsService,
  GetCampaignInsightsHttpInput,
  GetCampaignInsightsHttpResult,
  CampaignInsight,
} from '@vendepro/core'

/**
 * HTTP adapter para Meta Marketing API (Ads Insights).
 *
 * Endpoint:
 *   GET https://graph.facebook.com/v17.0/act_{id}/insights
 *       ?level=campaign&fields=...&time_range={"since","until"}
 *
 * Requiere token con permiso `ads_read` sobre el ad account.
 */

// action_types que Meta usa para reportar leads según el origen
// (formulario nativo, pixel en la web, o el agregado 'lead').
const LEAD_ACTION_TYPES = new Set([
  'lead',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
])

export class MetaAdsInsightsHttp implements MetaAdsInsightsService {
  async getCampaignInsights(input: GetCampaignInsightsHttpInput): Promise<GetCampaignInsightsHttpResult> {
    if (!input.adAccountId) return { ok: false, status: 0, campaigns: [], error: 'adAccountId is required' }
    if (!input.accessToken) return { ok: false, status: 0, campaigns: [], error: 'accessToken is required' }

    const account = input.adAccountId.startsWith('act_') ? input.adAccountId : `act_${input.adAccountId}`
    const url = new URL(`https://graph.facebook.com/v17.0/${account}/insights`)
    url.searchParams.set('level', 'campaign')
    url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency')
    url.searchParams.set('time_range', JSON.stringify({ since: input.since, until: input.until }))
    url.searchParams.set('limit', '100')
    url.searchParams.set('access_token', input.accessToken)

    try {
      const res = await fetch(url.toString())
      const body = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          campaigns: [],
          error: body?.error?.message ?? `HTTP ${res.status}`,
        }
      }

      const campaigns: CampaignInsight[] = ((body?.data ?? []) as any[]).map(row => {
        const leads = ((row.actions ?? []) as any[])
          // 'lead' agrega las variantes onsite/offsite — si viene, es el total;
          // si no, sumamos las variantes específicas.
          .filter(a => LEAD_ACTION_TYPES.has(a.action_type))
          .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0)
        return {
          campaign_id: String(row.campaign_id ?? ''),
          campaign_name: String(row.campaign_name ?? ''),
          spend: Number(row.spend) || 0,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          leads,
          account_currency: row.account_currency ?? null,
        }
      })

      return { ok: true, status: res.status, campaigns }
    } catch (err: any) {
      return { ok: false, status: 0, campaigns: [], error: err?.message ?? 'network error' }
    }
  }
}
