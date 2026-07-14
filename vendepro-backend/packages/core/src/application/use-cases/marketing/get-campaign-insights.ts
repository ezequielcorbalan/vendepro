import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { MetaAdsInsightsService, CampaignInsight } from '../../ports/services/meta-ads-insights'

export type TokenDecryptor = (ciphertext: string) => Promise<string | null>

export interface GetCampaignInsightsInput {
  /** Agente cuyo Ad Account se consulta (config por-agente). */
  agentId: string
  /** YYYY-MM-DD */
  since: string
  /** YYYY-MM-DD */
  until: string
}

/**
 * - not_configured: integración Meta apagada o sin access token
 * - missing_ad_account: falta cargar el Ad Account ID en Ajustes → Marketing
 * - token_error: el token guardado no se pudo desencriptar (rotó JWT_SECRET)
 * - api_error: Meta rechazó la llamada (típico: token sin permiso ads_read)
 */
export type CampaignInsightsStatus = 'ok' | 'not_configured' | 'missing_ad_account' | 'token_error' | 'api_error'

export interface GetCampaignInsightsOutput {
  status: CampaignInsightsStatus
  campaigns: CampaignInsight[]
  error?: string
}

export class GetCampaignInsightsUseCase {
  constructor(
    private readonly repo: MetaIntegrationRepository,
    private readonly insights: MetaAdsInsightsService,
    private readonly decryptToken: TokenDecryptor,
  ) {}

  async execute(input: GetCampaignInsightsInput): Promise<GetCampaignInsightsOutput> {
    const integration = await this.repo.findByAgent(input.agentId)
    if (!integration || !integration.enabled || !integration.access_token_encrypted) {
      return { status: 'not_configured', campaigns: [] }
    }
    if (!integration.ad_account_id) {
      return { status: 'missing_ad_account', campaigns: [] }
    }

    const token = await this.decryptToken(integration.access_token_encrypted)
    if (!token) return { status: 'token_error', campaigns: [] }

    const result = await this.insights.getCampaignInsights({
      adAccountId: integration.ad_account_id,
      accessToken: token,
      since: input.since,
      until: input.until,
    })
    if (!result.ok) {
      return { status: 'api_error', campaigns: [], error: result.error }
    }
    return { status: 'ok', campaigns: result.campaigns }
  }
}
