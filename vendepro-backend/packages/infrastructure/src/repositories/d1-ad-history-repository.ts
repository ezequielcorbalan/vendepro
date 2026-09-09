import type {
  AdHistoryRepository,
  AdAccountRow,
  AdDailyInsight,
  AdCreativeInfo,
} from '@vendepro/core'

/** Ids determinísticos: re-sincronizar no crea filas nuevas. */
function rowId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${parts.join('_')}`
}

export class D1AdHistoryRepository implements AdHistoryRepository {
  constructor(private readonly db: D1Database) {}

  async listAccounts(orgId?: string): Promise<AdAccountRow[]> {
    const rows = (await (orgId
      ? this.db.prepare('SELECT * FROM ad_accounts WHERE enabled = 1 AND org_id = ? ORDER BY created_at').bind(orgId)
      : this.db.prepare('SELECT * FROM ad_accounts WHERE enabled = 1 ORDER BY org_id, created_at')
    ).all()).results as any[]

    return rows.map(r => ({
      id: r.id,
      org_id: r.org_id,
      provider: r.provider ?? 'meta',
      external_id: r.external_id,
      name: r.name ?? null,
      currency: r.currency ?? null,
      owner_user_id: r.owner_user_id ?? null,
      enabled: r.enabled === 1,
      last_synced_at: r.last_synced_at ?? null,
    }))
  }

  /**
   * Campañas y ad sets salen de los propios insights (traen id y nombre), y los
   * anuncios del listado de fichas. Un anuncio que aparece en los insights pero
   * no en las fichas se guarda igual con lo que se sabe: es preferible tener el
   * anuncio sin miniatura que perder su gasto por no poder pintarlo.
   */
  async upsertStructure(input: {
    account: AdAccountRow
    insights: AdDailyInsight[]
    ads: AdCreativeInfo[]
  }): Promise<void> {
    const { account, insights, ads } = input
    const now = new Date().toISOString()
    const stmts: D1PreparedStatement[] = []

    const campaigns = new Map<string, string | null>()
    const adSets = new Map<string, { name: string | null; campaign: string }>()
    const fromInsights = new Map<string, AdDailyInsight>()

    for (const i of insights) {
      if (i.campaign_id) campaigns.set(i.campaign_id, i.campaign_name)
      if (i.ad_set_id) adSets.set(i.ad_set_id, { name: i.ad_set_name, campaign: i.campaign_id })
      if (i.ad_id && !fromInsights.has(i.ad_id)) fromInsights.set(i.ad_id, i)
    }

    for (const [externalId, name] of campaigns) {
      stmts.push(this.db.prepare(`
        INSERT INTO ad_campaigns (id, org_id, account_id, external_id, name, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(account_id, external_id) DO UPDATE SET
          name = excluded.name, updated_at = excluded.updated_at
      `).bind(rowId('adcmp', account.id, externalId), account.org_id, account.id, externalId, name, now))
    }

    for (const [externalId, set] of adSets) {
      stmts.push(this.db.prepare(`
        INSERT INTO ad_sets (id, org_id, account_id, campaign_external_id, external_id, name, updated_at)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(account_id, external_id) DO UPDATE SET
          name = excluded.name,
          campaign_external_id = excluded.campaign_external_id,
          updated_at = excluded.updated_at
      `).bind(rowId('adset', account.id, externalId), account.org_id, account.id, set.campaign, externalId, set.name, now))
    }

    const byAdId = new Map(ads.map(a => [a.ad_id, a]))
    for (const [adId, insight] of fromInsights) {
      const card = byAdId.get(adId) ?? null
      stmts.push(this.db.prepare(`
        INSERT INTO ads (
          id, org_id, account_id, campaign_external_id, ad_set_external_id, external_id,
          name, status, creative_thumbnail_url, creative_title, creative_body,
          creative_permalink, destination_url, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(account_id, external_id) DO UPDATE SET
          campaign_external_id = excluded.campaign_external_id,
          ad_set_external_id = excluded.ad_set_external_id,
          name = excluded.name,
          status = COALESCE(excluded.status, ads.status),
          -- Los campos del creativo sólo se pisan si vinieron: si la llamada de
          -- fichas falló, no hay que borrar la miniatura que ya estaba.
          creative_thumbnail_url = COALESCE(excluded.creative_thumbnail_url, ads.creative_thumbnail_url),
          creative_title = COALESCE(excluded.creative_title, ads.creative_title),
          creative_body = COALESCE(excluded.creative_body, ads.creative_body),
          creative_permalink = COALESCE(excluded.creative_permalink, ads.creative_permalink),
          destination_url = COALESCE(excluded.destination_url, ads.destination_url),
          updated_at = excluded.updated_at
      `).bind(
        rowId('ad', account.id, adId), account.org_id, account.id,
        insight.campaign_id, insight.ad_set_id, adId,
        card?.name ?? insight.ad_name, card?.status ?? null,
        card?.thumbnail_url ?? null, card?.title ?? null, card?.body ?? null,
        card?.permalink ?? null, card?.destination_url ?? null, now,
      ))
    }

    await this.runBatched(stmts)
  }

  async upsertDailyMetrics(account: AdAccountRow, insights: AdDailyInsight[]): Promise<void> {
    const now = new Date().toISOString()
    const stmts = insights
      .filter(i => i.ad_id && i.date)
      .map(i => this.db.prepare(`
        INSERT INTO ad_daily_metrics (
          id, org_id, account_id, ad_external_id, campaign_external_id, ad_set_external_id,
          date, spend, impressions, clicks, leads, reach, frequency, currency, synced_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(org_id, ad_external_id, date) DO UPDATE SET
          spend = excluded.spend,
          impressions = excluded.impressions,
          clicks = excluded.clicks,
          leads = excluded.leads,
          reach = excluded.reach,
          frequency = excluded.frequency,
          currency = excluded.currency,
          synced_at = excluded.synced_at
      `).bind(
        rowId('adm', account.org_id, i.ad_id, i.date), account.org_id, account.id,
        i.ad_id, i.campaign_id, i.ad_set_id, i.date,
        i.spend, i.impressions, i.clicks, i.leads,
        i.reach, i.frequency, i.account_currency, now,
      ))

    await this.runBatched(stmts)
  }

  async markSynced(accountId: string, at: string, error?: string | null): Promise<void> {
    await this.db.prepare(
      'UPDATE ad_accounts SET last_synced_at = ?, last_sync_error = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ).bind(at, error ?? null, accountId).run()
  }

  /**
   * D1 tiene un tope de sentencias por batch, y una cuenta con muchos anuncios
   * por varios días supera fácil las mil filas. Se parte en tandas.
   */
  private async runBatched(stmts: D1PreparedStatement[], size = 50): Promise<void> {
    for (let i = 0; i < stmts.length; i += size) {
      await this.db.batch(stmts.slice(i, i + size))
    }
  }
}
