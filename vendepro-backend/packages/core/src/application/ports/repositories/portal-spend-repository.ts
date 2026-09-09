import type { PortalSpend } from '../../../domain/entities/portal-spend'
import type { PortalLeadCount } from '../../../domain/rules/portal-cost-rules'

export interface PortalSpendRepository {
  /** Gasto de la org, opcionalmente acotado a un rango de meses 'YYYY-MM' (inclusive). */
  findByOrg(orgId: string, opts?: { fromMonth?: string; toMonth?: string; ownerUserId?: string }): Promise<PortalSpend[]>
  findById(id: string, orgId: string): Promise<PortalSpend | null>
  /** Upsert por (org, portal, mes): recargar el mismo mes pisa la fila. */
  save(spend: PortalSpend): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}

/**
 * Conteo de leads compradores por fuente, para cruzar contra el gasto.
 * Vive acá y no en el repo de leads porque la pregunta es de marketing:
 * "cuántos leads trajo cada portal en este rango".
 */
export interface PortalLeadCountRepository {
  /** `ownerUserId` acota a los leads asignados a ese agente (marketing por usuario). */
  countBuyerLeadsBySource(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PortalLeadCount[]>
}
