import type { IntegrationSyncLogRepository, IntegrationSyncLogEntry } from '@vendepro/core'

export class D1IntegrationSyncLogRepository implements IntegrationSyncLogRepository {
  constructor(private readonly db: D1Database) {}

  async save(entry: IntegrationSyncLogEntry): Promise<void> {
    await this.db.prepare(`
      INSERT INTO integration_sync_log (
        id, org_id, integration_id, kind, status,
        contacts_created, contacts_skipped, error, started_at, finished_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(
      entry.id,
      entry.org_id,
      entry.integration_id,
      entry.kind,
      entry.status,
      entry.contacts_created,
      entry.contacts_skipped,
      entry.error,
      entry.started_at,
      entry.finished_at,
    ).run()
  }

  async listByOrg(orgId: string, limit: number): Promise<IntegrationSyncLogEntry[]> {
    const rows = (await this.db
      .prepare(`SELECT * FROM integration_sync_log WHERE org_id = ? ORDER BY started_at DESC LIMIT ?`)
      .bind(orgId, limit)
      .all()).results as any[]
    return rows.map(r => ({
      id: r.id,
      org_id: r.org_id,
      integration_id: r.integration_id,
      kind: r.kind,
      status: r.status,
      contacts_created: r.contacts_created ?? 0,
      contacts_skipped: r.contacts_skipped ?? 0,
      error: r.error ?? null,
      started_at: r.started_at,
      finished_at: r.finished_at ?? null,
    }))
  }
}
