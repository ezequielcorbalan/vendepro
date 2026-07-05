import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { KitepropGateway, KitepropTestResult } from '../../ports/services/kiteprop-gateway'

export type TokenDecryptor = (ciphertext: string) => Promise<string | null>

export interface TestKitepropConnectionInput {
  orgId: string
  /** Si viene, se prueba esta key (antes de guardar). Si no, la guardada. */
  api_key?: string
}

export class TestKitepropConnectionUseCase {
  constructor(
    private readonly integrationRepo: OrgIntegrationRepository,
    private readonly gateway: KitepropGateway,
    private readonly decryptKey: TokenDecryptor,
  ) {}

  async execute(input: TestKitepropConnectionInput): Promise<KitepropTestResult> {
    let apiKey = input.api_key?.trim() || null

    if (!apiKey) {
      const integration = await this.integrationRepo.findByOrgAndProvider(input.orgId, 'kiteprop')
      if (!integration?.credentials_encrypted) {
        return { ok: false, error: 'No hay API key configurada' }
      }
      apiKey = await this.decryptKey(integration.credentials_encrypted)
      if (!apiKey) {
        return { ok: false, error: 'No se pudo desencriptar la API key guardada. Volvé a ingresarla.' }
      }
    }

    return this.gateway.testConnection(apiKey)
  }
}
