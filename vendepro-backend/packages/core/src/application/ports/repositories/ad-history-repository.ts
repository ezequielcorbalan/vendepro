import type { AdDailyInsight, AdCreativeInfo } from '../services/meta-ads-insights'

export interface AdAccountRow {
  id: string
  org_id: string
  provider: string
  external_id: string
  name: string | null
  currency: string | null
  /** `null` = cuenta de la agencia. Hoy sólo las de agente tienen token. */
  owner_user_id: string | null
  enabled: boolean
  last_synced_at: string | null
}

export interface AdHistoryRepository {
  /** Cuentas habilitadas — sin `orgId` devuelve las de todas las orgs (cron). */
  listAccounts(orgId?: string): Promise<AdAccountRow[]>

  /** Alta/actualización de campañas, ad sets y anuncios con su creativo. */
  upsertStructure(input: {
    account: AdAccountRow
    insights: AdDailyInsight[]
    ads: AdCreativeInfo[]
  }): Promise<void>

  /** Upsert por (org, anuncio, día): re-bajar un día lo corrige, no lo duplica. */
  upsertDailyMetrics(account: AdAccountRow, insights: AdDailyInsight[]): Promise<void>

  markSynced(accountId: string, at: string, error?: string | null): Promise<void>
}
