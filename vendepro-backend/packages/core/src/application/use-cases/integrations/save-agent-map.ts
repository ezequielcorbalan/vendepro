import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'

const PROVIDER = 'kiteprop'

export interface SaveAgentMapInput {
  orgId: string
  /** id agente KiteProp → id usuario VendéPro. Una entrada vacía/"" desmapea. */
  map: Record<string, string>
}

/** Guarda el mapeo de agentes KiteProp→VendéPro en config_json de la integración. */
export class SaveAgentMapUseCase {
  constructor(private readonly repo: OrgIntegrationRepository) {}

  async execute(input: SaveAgentMapInput): Promise<{ ok: boolean; map: Record<string, string> }> {
    const integration = await this.repo.findByOrgAndProvider(input.orgId, PROVIDER)
    if (!integration) return { ok: false, map: {} }

    // Normaliza: descarta entradas sin usuario destino.
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(input.map ?? {})) {
      if (typeof v === 'string' && v.trim()) clean[String(k)] = v.trim()
    }

    const config = integration.getConfig()
    integration.setConfig({ ...config, agent_map: clean })
    await this.repo.save(integration)
    return { ok: true, map: clean }
  }
}
