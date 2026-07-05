export interface IntegrationSyncLogEntry {
  id: string
  org_id: string
  integration_id: string
  kind: 'auto' | 'manual' | 'backfill' | 'test'
  status: 'ok' | 'partial' | 'error'
  contacts_created: number
  contacts_skipped: number
  error: string | null
  started_at: string
  finished_at: string | null
}

export interface IntegrationSyncLogRepository {
  save(entry: IntegrationSyncLogEntry): Promise<void>
  listByOrg(orgId: string, limit: number): Promise<IntegrationSyncLogEntry[]>
}
