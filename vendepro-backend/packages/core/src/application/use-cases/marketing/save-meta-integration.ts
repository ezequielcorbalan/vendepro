import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import { MetaIntegration } from '../../../domain/entities/meta-integration'

/**
 * Encriptador inyectable. La infraestructura proveerá una implementación
 * que use AES-GCM con la clave derivada del JWT_SECRET.
 */
export type TokenEncryptor = (plaintext: string) => Promise<string>

export interface SaveMetaIntegrationInput {
  orgId: string
  pixel_id?: string | null
  /** Si viene undefined o '********' (placeholder), no se actualiza el token. */
  access_token?: string | null
  stape_endpoint?: string | null
  gtm_container_id?: string | null
  test_event_code?: string | null
  enabled?: boolean
}

const TOKEN_PLACEHOLDER = '********'

export class SaveMetaIntegrationUseCase {
  constructor(
    private readonly repo: MetaIntegrationRepository,
    private readonly encryptToken: TokenEncryptor,
  ) {}

  async execute(input: SaveMetaIntegrationInput): Promise<{ ok: true }> {
    const existing = await this.repo.findByOrg(input.orgId)

    let encryptedToken: string | null = existing?.access_token_encrypted ?? null
    const incoming = input.access_token

    // Sólo re-encriptamos si el cliente mandó un valor real (distinto a undefined,
    // null, '' o el placeholder de la UI).
    if (incoming !== undefined && incoming !== null && incoming !== '' && incoming !== TOKEN_PLACEHOLDER) {
      encryptedToken = await this.encryptToken(incoming)
    } else if (incoming === '') {
      // String vacío explícito = limpiar token
      encryptedToken = null
    }

    const next = existing ?? MetaIntegration.create({
      org_id: input.orgId,
      pixel_id: null,
      access_token_encrypted: null,
      stape_endpoint: null,
      gtm_container_id: null,
      test_event_code: null,
    })

    next.update({
      pixel_id: input.pixel_id ?? next.pixel_id,
      access_token_encrypted: encryptedToken,
      stape_endpoint: input.stape_endpoint ?? next.stape_endpoint,
      gtm_container_id: input.gtm_container_id ?? next.gtm_container_id,
      test_event_code: input.test_event_code ?? next.test_event_code,
      enabled: input.enabled !== undefined ? input.enabled : next.enabled,
    })

    await this.repo.save(next)
    return { ok: true }
  }
}
