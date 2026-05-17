export type StageHistoryEntityType = 'lead' | 'reservation' | 'property'
export type StageHistoryTrigger = 'user' | 'sync' | 'system'

export interface StageHistoryEntry {
  id: string
  org_id: string
  entity_type: StageHistoryEntityType
  entity_id: string
  from_stage: string | null
  to_stage: string
  changed_by: string
  changed_at: string
  notes: string | null
  triggered_by?: StageHistoryTrigger
  changed_by_name?: string | null
}

export interface StageHistoryRepository {
  findByEntity(entityType: StageHistoryEntityType, entityId: string, orgId: string): Promise<StageHistoryEntry[]>
  log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void>
}
