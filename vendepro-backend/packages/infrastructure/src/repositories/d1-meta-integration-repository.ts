import { MetaIntegration } from '@vendepro/core'
import type { MetaIntegrationRepository } from '@vendepro/core'

export class D1MetaIntegrationRepository implements MetaIntegrationRepository {
  constructor(private readonly db: D1Database) {}

  async findByAgent(agentId: string): Promise<MetaIntegration | null> {
    const row = await this.db
      .prepare(`SELECT * FROM meta_integration WHERE agent_id = ?`)
      .bind(agentId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(integration: MetaIntegration): Promise<void> {
    const o = integration.toObject()
    await this.db.prepare(`
      INSERT INTO meta_integration (
        agent_id, org_id, pixel_id, access_token_encrypted, stape_endpoint,
        gtm_container_id, test_event_code, ad_account_id, enabled,
        ga4_measurement_id, ga4_api_secret_encrypted, ga4_enabled,
        created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(agent_id) DO UPDATE SET
        pixel_id=excluded.pixel_id,
        access_token_encrypted=excluded.access_token_encrypted,
        stape_endpoint=excluded.stape_endpoint,
        gtm_container_id=excluded.gtm_container_id,
        test_event_code=excluded.test_event_code,
        ad_account_id=excluded.ad_account_id,
        enabled=excluded.enabled,
        ga4_measurement_id=excluded.ga4_measurement_id,
        ga4_api_secret_encrypted=excluded.ga4_api_secret_encrypted,
        ga4_enabled=excluded.ga4_enabled,
        updated_at=excluded.updated_at
    `).bind(
      o.agent_id,
      o.org_id,
      o.pixel_id,
      o.access_token_encrypted,
      o.stape_endpoint,
      o.gtm_container_id,
      o.test_event_code,
      o.ad_account_id,
      o.enabled ? 1 : 0,
      o.ga4_measurement_id,
      o.ga4_api_secret_encrypted,
      o.ga4_enabled ? 1 : 0,
      o.created_at,
      o.updated_at,
    ).run()
  }

  private toEntity(row: any): MetaIntegration {
    return MetaIntegration.fromPersistence({
      agent_id: row.agent_id,
      org_id: row.org_id,
      pixel_id: row.pixel_id ?? null,
      access_token_encrypted: row.access_token_encrypted ?? null,
      stape_endpoint: row.stape_endpoint ?? null,
      gtm_container_id: row.gtm_container_id ?? null,
      test_event_code: row.test_event_code ?? null,
      ad_account_id: row.ad_account_id ?? null,
      enabled: !!row.enabled,
      ga4_measurement_id: row.ga4_measurement_id ?? null,
      ga4_api_secret_encrypted: row.ga4_api_secret_encrypted ?? null,
      ga4_enabled: !!row.ga4_enabled,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
