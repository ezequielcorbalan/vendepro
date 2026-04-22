import type { MetaIntegration } from '../../../domain/entities/meta-integration'

export interface MetaIntegrationRepository {
  findByOrg(orgId: string): Promise<MetaIntegration | null>
  save(integration: MetaIntegration): Promise<void>
}
