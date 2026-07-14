import type { MetaEventLog } from '../../../domain/entities/meta-event-log'

export interface MetaEventLogRepository {
  save(log: MetaEventLog): Promise<void>
  findById(id: string, orgId: string): Promise<MetaEventLog | null>
  findByEventId(eventId: string, orgId: string): Promise<MetaEventLog | null>
  findFailedToRetry(orgId: string, maxAttempts: number, limit: number): Promise<MetaEventLog[]>
  findRecentByOrg(orgId: string, limit: number): Promise<MetaEventLog[]>
  /** Eventos recientes de un agente puntual (para el log "mis eventos"). */
  findRecentByAgent(agentId: string, limit: number): Promise<MetaEventLog[]>
}
