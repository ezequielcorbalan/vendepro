import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import { DOCS_INTEGRATION_PROVIDER, parseDocsIntegrationConfig, type DocsEngine } from '../../../domain/entities/doc-portal'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'
import { GetGoogleDriveStatusUseCase, type GoogleDriveStatus } from './google-drive-connection'

export interface DocsIntegrationSettingsView {
  enabled: boolean
  engine: DocsEngine
  upload_url: string
  done_url: string
  agent_map: Record<string, string>
  drive: GoogleDriveStatus
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
    const [integration, drive] = await Promise.all([
      this.repo.findByOrgAndProvider(orgId, DOCS_INTEGRATION_PROVIDER),
      new GetGoogleDriveStatusUseCase(this.repo).execute(orgId),
    ])
    const config = parseDocsIntegrationConfig(integration?.config_json)
    // Sin nada guardado, se propone el motor propio: es el que anda sin configurar.
    const engine: DocsEngine = config?.engine ?? (integration ? 'n8n' : 'google_drive')
    const ready = engine === 'google_drive' ? drive.connected : !!config?.upload_url
    return {
      enabled: !!integration?.enabled && ready,
      engine,
      upload_url: config?.upload_url ?? '',
      done_url: config?.done_url ?? '',
      agent_map: config?.agent_map ?? {},
      drive,
    }
  }
}

export interface SaveDocsIntegrationSettingsInput {
  org_id: string
  role: string
  enabled: boolean
  engine?: DocsEngine | null
  upload_url?: string | null
  done_url?: string | null
  agent_map?: Record<string, string> | null
}

/** Sólo admin: define dónde van los archivos de toda la org. */
export class SaveDocsIntegrationSettingsUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveDocsIntegrationSettingsInput): Promise<DocsIntegrationSettingsView> {
    if (!isAdmin(input.role)) throw new ForbiddenError('Sólo un administrador puede configurar la documentación')

    const engine: DocsEngine = input.engine === 'n8n' ? 'n8n' : 'google_drive'
    const upload_url = (input.upload_url ?? '').trim()
    const done_url = (input.done_url ?? '').trim()
    if (engine === 'n8n') {
      if (input.enabled && !isHttpsUrl(upload_url)) throw new ValidationError('La URL de subida tiene que ser https')
      if (done_url && !isHttpsUrl(done_url)) throw new ValidationError('La URL de cierre tiene que ser https')
    } else if (input.enabled) {
      const drive = await new GetGoogleDriveStatusUseCase(this.repo).execute(input.org_id)
      if (!drive.connected) throw new ValidationError('Conectá el Google Drive de la inmobiliaria antes de activar la carga')
    }

    const agent_map: Record<string, string> = {}
    for (const [userId, alias] of Object.entries(input.agent_map ?? {})) {
      if (typeof alias === 'string' && alias.trim()) agent_map[userId] = alias.trim().toLowerCase()
    }

    const existing = await this.repo.findByOrgAndProvider(input.org_id, DOCS_INTEGRATION_PROVIDER)
    const integration = existing ?? OrgIntegration.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      provider: DOCS_INTEGRATION_PROVIDER,
      name: 'Documentación de propiedades',
    })
    integration.update({ enabled: input.enabled, config_json: JSON.stringify({ engine, upload_url, done_url, agent_map }) })
    await this.repo.save(integration)

    return new GetDocsIntegrationSettingsUseCase(this.repo).execute(input.org_id)
  }
}
