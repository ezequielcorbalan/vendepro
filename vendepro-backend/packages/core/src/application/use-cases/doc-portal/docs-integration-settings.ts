import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import { DOCS_INTEGRATION_PROVIDER, parseDocsIntegrationConfig } from '../../../domain/entities/doc-portal'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface DocsIntegrationSettingsView {
  enabled: boolean
  upload_url: string
  done_url: string
  agent_map: Record<string, string>
}

const isAdmin = (role: string) => role === 'admin' || role === 'owner'

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export class GetDocsIntegrationSettingsUseCase {
  constructor(private readonly repo: OrgIntegrationRepository) {}

  async execute(orgId: string): Promise<DocsIntegrationSettingsView> {
    const integration = await this.repo.findByOrgAndProvider(orgId, DOCS_INTEGRATION_PROVIDER)
    const config = parseDocsIntegrationConfig(integration?.config_json)
    return {
      enabled: !!integration?.enabled && !!config,
      upload_url: config?.upload_url ?? '',
      done_url: config?.done_url ?? '',
      agent_map: config?.agent_map ?? {},
    }
  }
}

export interface SaveDocsIntegrationSettingsInput {
  org_id: string
  role: string
  enabled: boolean
  upload_url: string
  done_url?: string | null
  agent_map?: Record<string, string> | null
}

/** Sólo admin: define a qué webhook se mandan los archivos de toda la org. */
export class SaveDocsIntegrationSettingsUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveDocsIntegrationSettingsInput): Promise<DocsIntegrationSettingsView> {
    if (!isAdmin(input.role)) throw new ForbiddenError('Sólo un administrador puede configurar la documentación')

    const upload_url = (input.upload_url ?? '').trim()
    const done_url = (input.done_url ?? '').trim()
    if (input.enabled && !isHttpsUrl(upload_url)) {
      throw new ValidationError('La URL de subida tiene que ser https')
    }
    if (done_url && !isHttpsUrl(done_url)) {
      throw new ValidationError('La URL de cierre tiene que ser https')
    }

    const agent_map: Record<string, string> = {}
    for (const [userId, alias] of Object.entries(input.agent_map ?? {})) {
      if (typeof alias === 'string' && alias.trim()) agent_map[userId] = alias.trim().toLowerCase()
    }

    const config = { upload_url, done_url, agent_map }
    const existing = await this.repo.findByOrgAndProvider(input.org_id, DOCS_INTEGRATION_PROVIDER)
    const integration = existing ?? OrgIntegration.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      provider: DOCS_INTEGRATION_PROVIDER,
      name: 'Documentación (n8n)',
    })
    integration.update({ enabled: input.enabled, config_json: JSON.stringify(config) })
    await this.repo.save(integration)

    return { enabled: input.enabled && !!upload_url, upload_url, done_url, agent_map }
  }
}
