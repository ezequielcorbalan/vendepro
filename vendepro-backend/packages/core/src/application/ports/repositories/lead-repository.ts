import type { Lead } from '../../../domain/entities/lead'

export interface LeadFilters {
  stage?: string
  agent_id?: string
  search?: string
  /** 'vendedor' | 'comprador'. Sin filtro devuelve ambos (backward-compat). */
  pipeline?: string
}

export interface LeadRepository {
  findById(id: string, orgId: string): Promise<Lead | null>
  findByOrg(orgId: string, filters?: LeadFilters): Promise<Lead[]>
  save(lead: Lead): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  searchByName(orgId: string, query: string, limit: number): Promise<Array<{ id: string; full_name: string }>>
  findPendingFollowups(orgId: string, now: string, limit: number): Promise<Array<{ id: string; full_name: string; next_step: string | null; next_step_date: string | null; stage: string }>>
  /** Returns raw rows with assigned_name via JOIN — acceptable for CSV export outside domain types */
  exportAllWithAssignedName(orgId: string): Promise<Array<Record<string, unknown>>>
  /**
   * Lead abierto (stage no terminal: NOT IN invalido/finalizado/perdido, según
   * TERMINAL de lead-stage.ts) del contacto con el mismo source_detail.
   * Semántica NULL: sourceDetail null matchea leads con source_detail NULL
   * (dos consultas sin source_detail del mismo contacto cuentan como la misma consulta).
   * Usado por el dedup de import (doc/api-mejoras-integracion.md §2).
   */
  findOpenByContactAndSourceDetail(contactId: string, sourceDetail: string | null, orgId: string): Promise<Lead | null>
  /**
   * Lead comprador ABIERTO (stage no terminal del pipeline comprador) del contacto.
   * Regla de negocio: un solo lead comprador abierto por contacto — las consultas
   * nuevas del mismo contacto suman propiedades de interés, no leads.
   */
  findOpenBuyerByContact(contactId: string, orgId: string): Promise<Lead | null>
}
