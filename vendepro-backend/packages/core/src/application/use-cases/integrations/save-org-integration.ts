import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import type { TokenEncryptor } from '../marketing/save-meta-integration'

export interface SaveOrgIntegrationInput {
  orgId: string
  provider: string
  name?: string | null
  /** '********' (placeholder) → no actualiza; '' → limpia. */
  api_key?: string | null
  enabled?: boolean
}

const TOKEN_PLACEHOLDER = '********'

/**
 * Guarda/actualiza la integración de un provider para la org (PATCH semántico:
 * undefined preserva). La api key se cifra con el encryptor inyectado y nunca
 * vuelve en claro. Al habilitar por primera vez (enabled false→true con
 * last_sync_at null) se marca last_sync_at = ahora: el sync automático solo
 * trae contactos NUEVOS desde la activación; el histórico va por backfill.
 */
export class SaveOrgIntegrationUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly ids: IdGenerator,
    private readonly encryptKey: TokenEncryptor,
  ) {}

  async execute(input: SaveOrgIntegrationInput) {
    const existing = await this.repo.findByOrgAndProvider(input.orgId, input.provider)

    let credentials = existing?.credentials_encrypted ?? null
    if (input.api_key !== undefined && input.api_key !== null && input.api_key !== TOKEN_PLACEHOLDER) {
      credentials = input.api_key === '' ? null : await this.encryptKey(input.api_key.trim())
    }

    const next = existing ?? OrgIntegration.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      provider: input.provider,
    })

    const wasEnabled = next.enabled
    const nextEnabled = input.enabled !== undefined ? input.enabled : next.enabled

    next.update({
      name: input.name !== undefined ? (input.name?.trim() || null) : next.name,
      credentials_encrypted: credentials,
      enabled: nextEnabled,
      // Marca de activación: desde acá corre el sync incremental.
      last_sync_at: !wasEnabled && nextEnabled && !next.last_sync_at
        ? new Date().toISOString()
        : next.last_sync_at,
    })

    await this.repo.save(next)
    return next.toPublicView()
  }
}
