import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { KitepropGateway, KitepropAgentDTO } from '../../ports/services/kiteprop-gateway'
import type { TokenDecryptor } from './test-kiteprop-connection'

const PROVIDER = 'kiteprop'

export interface GetKitepropAgentsResult {
  kiteprop: KitepropAgentDTO[]
  map: Record<string, string>
  error?: string
}

/** Lista los agentes de KiteProp (para mapear) + el mapeo guardado. */
export class GetKitepropAgentsUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly gateway: KitepropGateway,
    private readonly decryptKey: TokenDecryptor,
  ) {}

  async execute(orgId: string): Promise<GetKitepropAgentsResult> {
    const integration = await this.repo.findByOrgAndProvider(orgId, PROVIDER)
    if (!integration || !integration.credentials_encrypted) {
      return { kiteprop: [], map: {}, error: 'No hay API key configurada' }
    }
    const config = integration.getConfig()
    const map = (config.agent_map && typeof config.agent_map === 'object') ? (config.agent_map as Record<string, string>) : {}

    const apiKey = await this.decryptKey(integration.credentials_encrypted)
    if (!apiKey) return { kiteprop: [], map, error: 'No se pudo desencriptar la API key' }

    try {
      const kiteprop = await this.gateway.fetchAgents(apiKey)
      return { kiteprop, map }
    } catch (e) {
      return { kiteprop: [], map, error: e instanceof Error ? e.message : 'Error consultando KiteProp' }
    }
  }
}
