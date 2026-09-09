import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'

/**
 * Config de tagging que una página pública necesita para inyectar GTM.
 *
 * Es lo único de `meta_integration` que puede salir sin auth: el ID de
 * contenedor de GTM y el dominio de Stape terminan igual en el HTML de la
 * página, no son secretos. El pixel_id, los tokens y el api_secret NO salen
 * por acá.
 */
export interface PublicTagConfig {
  gtm_container_id: string | null
  stape_endpoint: string | null
}

const EMPTY: PublicTagConfig = { gtm_container_id: null, stape_endpoint: null }

/**
 * Resuelve el contenedor de GTM del agente dueño de la página pública
 * (landing, ficha de visita, tasación).
 *
 * No mira `enabled`: ese flag prende el envío server-side de Meta CAPI, que es
 * otra cosa. Si el agente cargó un contenedor, la página lo inyecta — sin eso
 * los `dataLayer.push` del front no los lee nadie, que es exactamente lo que
 * pasaba en las landings.
 */
export class GetPublicTagConfigUseCase {
  constructor(private readonly integrations: MetaIntegrationRepository) {}

  async execute(agentId: string | null | undefined): Promise<PublicTagConfig> {
    if (!agentId) return EMPTY
    const integration = await this.integrations.findByAgent(agentId).catch(() => null)
    if (!integration) return EMPTY
    return {
      gtm_container_id: integration.gtm_container_id ?? null,
      stape_endpoint: integration.stape_endpoint ?? null,
    }
  }
}
