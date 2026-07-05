import type { OrgIntegration } from '../../../domain/entities/org-integration'

export interface OrgIntegrationRepository {
  findByOrgAndProvider(orgId: string, provider: string): Promise<OrgIntegration | null>
  /** Upsert por UNIQUE(org_id, provider). */
  save(integration: OrgIntegration): Promise<void>
  /**
   * Integraciones habilitadas de un provider en TODAS las orgs.
   * SOLO para el scheduled handler (cron de sync) — es cross-org por diseño;
   * nunca exponer en rutas HTTP.
   */
  findEnabledByProvider(provider: string): Promise<OrgIntegration[]>
}
