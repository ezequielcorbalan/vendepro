import type { AdHistoryRepository, AdAccountRow } from '../../ports/repositories/ad-history-repository'
import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import type { MetaAdsInsightsService } from '../../ports/services/meta-ads-insights'
import { adSyncWindow } from '../../../domain/value-objects/marketing-period'

export type TokenDecryptorFn = (ciphertext: string) => Promise<string | null>

export type AccountSyncStatus =
  | 'ok'
  | 'no_owner'        // cuenta de la agencia: todavía no hay token propio (falta OAuth)
  | 'no_token'        // el agente dueño no tiene integración configurada
  | 'token_error'     // el token guardado no se pudo desencriptar
  | 'api_error'

export interface AccountSyncResult {
  account_id: string
  external_id: string
  status: AccountSyncStatus
  days: number
  ads: number
  rows: number
  error?: string
}

export interface SyncAdHistoryOutput {
  accounts: AccountSyncResult[]
  since: string
  until: string
}

/**
 * Baja el histórico de pauta y lo guarda.
 *
 * Se re-piden los últimos días completos en vez de sólo ayer porque **Meta
 * reatribuye hacia atrás**: una conversión de hace tres días puede aparecer
 * recién hoy. El guardado es upsert por (anuncio, día), así re-bajar corrige en
 * lugar de duplicar — ver `adSyncWindow`.
 *
 * Una cuenta que falla no frena a las demás: cada una reporta su estado y el
 * error queda guardado en la fila para que se vea en la UI. Un token vencido de
 * una inmobiliaria no puede dejar sin histórico a las otras.
 */
export class SyncAdHistoryUseCase {
  constructor(
    private readonly history: AdHistoryRepository,
    private readonly integrations: MetaIntegrationRepository,
    private readonly insights: MetaAdsInsightsService,
    private readonly decryptToken: TokenDecryptorFn,
  ) {}

  async execute(input: { orgId?: string; now?: Date; lookbackDays?: number } = {}): Promise<SyncAdHistoryOutput> {
    const { since, until } = adSyncWindow(input.now ?? new Date(), input.lookbackDays ?? 7)
    const accounts = await this.history.listAccounts(input.orgId)

    const results: AccountSyncResult[] = []
    for (const account of accounts) {
      results.push(await this.syncAccount(account, since, until))
    }

    return { accounts: results, since, until }
  }

  private async syncAccount(account: AdAccountRow, since: string, until: string): Promise<AccountSyncResult> {
    const base = { account_id: account.id, external_id: account.external_id, days: 0, ads: 0, rows: 0 }

    // Las cuentas de la agencia todavía no tienen token propio: el token vive
    // en la integración del agente. Se resuelve cuando entre el OAuth (F4).
    if (!account.owner_user_id) {
      return { ...base, status: 'no_owner' }
    }

    const integration = await this.integrations.findByAgent(account.owner_user_id).catch(() => null)
    if (!integration?.access_token_encrypted) {
      return { ...base, status: 'no_token' }
    }

    const token = await this.decryptToken(integration.access_token_encrypted).catch(() => null)
    if (!token) {
      await this.history.markSynced(account.id, new Date().toISOString(), 'token_error')
      return { ...base, status: 'token_error' }
    }

    const insightsResult = await this.insights.getAdInsights({
      adAccountId: account.external_id,
      accessToken: token,
      since,
      until,
    })
    if (!insightsResult.ok) {
      await this.history.markSynced(account.id, new Date().toISOString(), insightsResult.error ?? 'api_error')
      return { ...base, status: 'api_error', error: insightsResult.error }
    }

    // Las fichas de los anuncios son un extra: si fallan, el histórico de
    // métricas igual se guarda. Perder la miniatura del creativo es mucho menos
    // grave que perder el gasto del día.
    const adsResult = await this.insights.getAds({
      adAccountId: account.external_id,
      accessToken: token,
    }).catch(() => ({ ok: false as const, status: 0, ads: [] }))

    const insights = insightsResult.insights
    const ads = adsResult.ok ? adsResult.ads : []

    await this.history.upsertStructure({ account, insights, ads })
    await this.history.upsertDailyMetrics(account, insights)
    await this.history.markSynced(account.id, new Date().toISOString(), null)

    return {
      ...base,
      status: 'ok',
      days: new Set(insights.map(i => i.date)).size,
      ads: ads.length,
      rows: insights.length,
    }
  }
}
