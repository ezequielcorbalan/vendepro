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

/**
 * Métricas de UN anuncio en UN día. Es la unidad mínima que guarda el
 * histórico: campaña y ad set se calculan sumando estas filas, así no hay dos
 * fuentes del mismo número que puedan divergir.
 */
export interface AdDailyInsight {
  date: string                      // YYYY-MM-DD
  ad_id: string
  ad_name: string | null
  ad_set_id: string | null
  ad_set_name: string | null
  campaign_id: string
  campaign_name: string | null
  spend: number
  impressions: number
  clicks: number
  leads: number
  /** No se agregan hacia arriba: Meta los deduplica por persona. */
  reach: number | null
  frequency: number | null
  account_currency: string | null
}

export interface GetAdInsightsInput {
  adAccountId: string
  accessToken: string
  /** YYYY-MM-DD, inclusive */
  since: string
  /** YYYY-MM-DD, inclusive */
  until: string
}

export interface GetAdInsightsResult {
  ok: boolean
  status: number
  insights: AdDailyInsight[]
  error?: string
}

/** Ficha del anuncio: lo que no cambia por día (nombre, estado, creativo). */
export interface AdCreativeInfo {
  ad_id: string
  name: string | null
  status: string | null
  campaign_id: string | null
  ad_set_id: string | null
  thumbnail_url: string | null
  title: string | null
  body: string | null
  permalink: string | null
  destination_url: string | null
}

export interface GetAdsResult {
  ok: boolean
  status: number
  ads: AdCreativeInfo[]
  error?: string
}

export interface MetaAdsInsightsService {
  getCampaignInsights(input: GetCampaignInsightsHttpInput): Promise<GetCampaignInsightsHttpResult>
  /** Insights día por día a nivel anuncio — la materia prima del histórico. */
  getAdInsights(input: GetAdInsightsInput): Promise<GetAdInsightsResult>
  /** Fichas de los anuncios con su creativo. */
  getAds(input: { adAccountId: string; accessToken: string }): Promise<GetAdsResult>
}
