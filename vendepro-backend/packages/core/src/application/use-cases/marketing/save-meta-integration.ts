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
  /** Ad Account de Meta (con o sin prefijo act_). */
  ad_account_id?: string | null
  enabled?: boolean
  // GA4 Measurement Protocol
  ga4_measurement_id?: string | null
  /** '********' → no actualiza; '' → limpia. */
  ga4_api_secret?: string | null
  ga4_enabled?: boolean
}

const TOKEN_PLACEHOLDER = '********'

/**
 * Normaliza campos de texto del form: '' → null (permite limpiar),
 * trim de espacios. undefined se preserva (patch parcial).
 */
function cleanText(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Como cleanText, pero asegura esquema https:// para endpoints. */
function cleanUrl(v: string | null | undefined): string | null | undefined {
  const t = cleanText(v)
  if (t === undefined || t === null) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

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
      ad_account_id: null,
      ga4_measurement_id: null,
      ga4_api_secret_encrypted: null,
    })

    const pixelId = cleanText(input.pixel_id)
    const stape = cleanUrl(input.stape_endpoint)
    const gtm = cleanText(input.gtm_container_id)
    const testCode = cleanText(input.test_event_code)
    const adAccount = cleanText(input.ad_account_id)
    const ga4Id = cleanText(input.ga4_measurement_id)

    next.update({
      pixel_id: pixelId !== undefined ? pixelId : next.pixel_id,
      access_token_encrypted: encryptedToken,
      stape_endpoint: stape !== undefined ? stape : next.stape_endpoint,
      gtm_container_id: gtm !== undefined ? gtm : next.gtm_container_id,
      test_event_code: testCode !== undefined ? testCode : next.test_event_code,
      ad_account_id: adAccount !== undefined ? adAccount : next.ad_account_id,
      enabled: input.enabled !== undefined ? input.enabled : next.enabled,
      ga4_measurement_id: ga4Id !== undefined ? ga4Id : next.ga4_measurement_id,
      ga4_api_secret_encrypted: encryptedGa4Secret,
      ga4_enabled: input.ga4_enabled !== undefined ? input.ga4_enabled : next.ga4_enabled,
    })

    await this.repo.save(next)
    return { ok: true }
  }
}
