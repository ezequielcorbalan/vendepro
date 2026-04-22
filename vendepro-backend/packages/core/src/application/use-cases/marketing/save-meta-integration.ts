import type { MetaIntegrationRepository } from '../../ports/repositories/meta-integration-repository'
import { MetaIntegration } from '../../../domain/entities/meta-integration'

export type TokenEncryptor = (plaintext: string) => Promise<string>

export interface SaveMetaIntegrationInput {
  orgId: string
  pixel_id?: string | null
  /** '********' (placeholder) → no actualiza; '' → limpia. */
  access_token?: string | null
  stape_endpoint?: string | null
  gtm_container_id?: string | null
  test_event_code?: string | null
  enabled?: boolean
  // GA4 Measurement Protocol
  ga4_measurement_id?: string | null
  /** '********' → no actualiza; '' → limpia. */
  ga4_api_secret?: string | null
  ga4_enabled?: boolean
}

const TOKEN_PLACEHOLDER = '********'

function applySecretPatch(
  incoming: string | null | undefined,
  existingCipher: string | null,
  encrypt: TokenEncryptor,
): Promise<string | null> {
  if (incoming === undefined || incoming === null || incoming === TOKEN_PLACEHOLDER) {
    return Promise.resolve(existingCipher)
  }
  if (incoming === '') return Promise.resolve(null)
  return encrypt(incoming)
}

export class SaveMetaIntegrationUseCase {
  constructor(
    private readonly repo: MetaIntegrationRepository,
    private readonly encryptToken: TokenEncryptor,
  ) {}

  async execute(input: SaveMetaIntegrationInput): Promise<{ ok: true }> {
    const existing = await this.repo.findByOrg(input.orgId)

    const encryptedToken = await applySecretPatch(
      input.access_token,
      existing?.access_token_encrypted ?? null,
      this.encryptToken,
    )
    const encryptedGa4Secret = await applySecretPatch(
      input.ga4_api_secret,
      existing?.ga4_api_secret_encrypted ?? null,
      this.encryptToken,
    )

    const next = existing ?? MetaIntegration.create({
      org_id: input.orgId,
      pixel_id: null,
      access_token_encrypted: null,
      stape_endpoint: null,
      gtm_container_id: null,
      test_event_code: null,
      ga4_measurement_id: null,
      ga4_api_secret_encrypted: null,
    })

    next.update({
      pixel_id: input.pixel_id ?? next.pixel_id,
      access_token_encrypted: encryptedToken,
      stape_endpoint: input.stape_endpoint ?? next.stape_endpoint,
      gtm_container_id: input.gtm_container_id ?? next.gtm_container_id,
      test_event_code: input.test_event_code ?? next.test_event_code,
      enabled: input.enabled !== undefined ? input.enabled : next.enabled,
      ga4_measurement_id: input.ga4_measurement_id ?? next.ga4_measurement_id,
      ga4_api_secret_encrypted: encryptedGa4Secret,
      ga4_enabled: input.ga4_enabled !== undefined ? input.ga4_enabled : next.ga4_enabled,
    })

    await this.repo.save(next)
    return { ok: true }
  }
}
