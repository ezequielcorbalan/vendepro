/**
 * Meta Marketing API (Ads Insights) service port.
 *
 * Lee performance de campañas del ad account:
 *   GET ${endpoint}/v17.0/act_{adAccountId}/insights?level=campaign
 *
 * Requiere un access token con permiso `ads_read` sobre el ad account
 * (el token de Conversion API no siempre lo incluye).
 */

export interface CampaignInsight {
  campaign_id: string
  campaign_name: string
  /** Gasto en la moneda del ad account. */
  spend: number
  impressions: number
  clicks: number
  /** Leads reportados por Meta (action_type 'lead' y variantes pixel/onsite). */
  leads: number
  account_currency: string | null
}

export interface GetCampaignInsightsHttpInput {
  /** Con o sin prefijo act_ */
  adAccountId: string
  accessToken: string
  /** YYYY-MM-DD */
  since: string
  /** YYYY-MM-DD */
  until: string
}

export interface GetCampaignInsightsHttpResult {
  ok: boolean
  status: number
  campaigns: CampaignInsight[]
  error?: string
}

export interface MetaAdsInsightsService {
  getCampaignInsights(input: GetCampaignInsightsHttpInput): Promise<GetCampaignInsightsHttpResult>
}
