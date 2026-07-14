import type { MetaIntegration } from '../../../domain/entities/meta-integration'

export interface MetaIntegrationRepository {
  /** Config del agente/usuario (la integración es por-agente, no por-org). */
  findByAgent(agentId: string): Promise<MetaIntegration | null>
  save(integration: MetaIntegration): Promise<void>
}
