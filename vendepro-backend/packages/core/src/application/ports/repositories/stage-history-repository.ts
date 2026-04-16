export interface StageHistoryEntry {
  id: string
  org_id: string
  entity_type: 'lead' | 'reservation'
  entity_id: string
  from_stage: string | null
  to_stage: string
  changed_by: string
  changed_at: string
  notes: string | null
  changed_by_name?: string | null
}

export interface StageHistoryRepository {
  findByEntity(entityType: 'lead' | 'reservation', entityId: string, orgId: string): Promise<StageHistoryEntry[]>
  log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void>
}
