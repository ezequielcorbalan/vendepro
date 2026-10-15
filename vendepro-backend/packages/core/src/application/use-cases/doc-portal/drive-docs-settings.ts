import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { DriveFolderRepository } from '../../ports/repositories/doc-portal-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { OrgIntegration } from '../../../domain/entities/org-integration'
import {
  DRIVE_DOCS_PROVIDER,
  parseDriveDocsConfig,
  type DriveFolder,
  type DriveFolderMatchStatus,
} from '../../../domain/entities/drive-documents'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canManagePropertyDocs, type DocPortalActor } from './manage-doc-portal-link'
import type { SyncDriveDocumentsUseCase, SyncDriveOrgResult } from './sync-drive-documents'

const isAdmin = (role: string) => role === 'admin' || role === 'owner'

export interface DriveDocsSettingsView {
  enabled: boolean
  shared_drive_id: string
  read_only: boolean
  ignore: string[]
}

export class GetDriveDocsSettingsUseCase {
  constructor(private readonly repo: OrgIntegrationRepository) {}

  async execute(orgId: string): Promise<DriveDocsSettingsView> {
    const integration = await this.repo.findByOrgAndProvider(orgId, DRIVE_DOCS_PROVIDER)
    const config = parseDriveDocsConfig(integration?.config_json)
    return {
      enabled: !!integration?.enabled && !!config,
      shared_drive_id: config?.shared_drive_id ?? '',
      read_only: config?.read_only ?? true,
      ignore: config?.ignore ?? [],
    }
  }
}

export interface SaveDriveDocsSettingsInput {
  org_id: string
  role: string
  enabled: boolean
  shared_drive_id: string
  read_only?: boolean
  ignore?: string[]
}

/** Sólo admin: qué unidad compartida se lee y si ya puede escribir en las propiedades. */
export class SaveDriveDocsSettingsUseCase {
  constructor(
    private readonly repo: OrgIntegrationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: SaveDriveDocsSettingsInput): Promise<DriveDocsSettingsView> {
    if (!isAdmin(input.role)) throw new ForbiddenError('Sólo un administrador puede configurar el Drive de documentación')
    const shared_drive_id = (input.shared_drive_id ?? '').trim()
    if (input.enabled && !/^[A-Za-z0-9_-]{10,}$/.test(shared_drive_id)) {
      throw new ValidationError('El id de la unidad compartida no es válido (es lo que sigue a /drive/folders/ en el link de la unidad)')
    }
    const config = {
      shared_drive_id,
      // Arranca en sólo lectura salvo que se apague explícitamente.
      read_only: input.read_only !== false,
      ignore: (input.ignore ?? []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()),
    }
    const existing = await this.repo.findByOrgAndProvider(input.org_id, DRIVE_DOCS_PROVIDER)
    const integration = existing ?? OrgIntegration.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      provider: DRIVE_DOCS_PROVIDER,
      name: 'Drive de documentación',
    })
    integration.update({ enabled: input.enabled, config_json: JSON.stringify(config) })
    await this.repo.save(integration)
    return { enabled: input.enabled && !!shared_drive_id, ...config }
  }
}

export interface DriveFolderView extends DriveFolder {
  property_address: string | null
}

/** Carpetas leídas del Drive, con la dirección de la propiedad vinculada. */
export class ListDriveFoldersUseCase {
  constructor(
    private readonly folders: DriveFolderRepository,
    private readonly properties: PropertyRepository,
  ) {}

  async execute(orgId: string, status?: DriveFolderMatchStatus): Promise<DriveFolderView[]> {
    const [folders, properties] = await Promise.all([this.folders.listByOrg(orgId), this.properties.findByOrg(orgId)])
    const address = new Map(properties.map((p) => [p.id, p.address]))
    return folders
      .filter((f) => !status || f.match_status === status)
      .map((f) => ({ ...f, property_address: f.property_id ? (address.get(f.property_id) ?? null) : null }))
  }
}

export interface LinkDriveFolderInput {
  org_id: string
  role: string
  folder_id: string
  /** null + ignore=false = volver al matcheo automático. */
  property_id: string | null
  ignore?: boolean
}

/**
 * Vinculación a mano de la bandeja "Carpetas sin asignar". Lo manual queda
 * fijo: el barrido no lo recalcula.
 */
export class LinkDriveFolderUseCase {
  constructor(
    private readonly folders: DriveFolderRepository,
    private readonly properties: PropertyRepository,
  ) {}

  async execute(input: LinkDriveFolderInput): Promise<{ folder_id: string; property_id: string | null; match_status: DriveFolderMatchStatus }> {
    if (!isAdmin(input.role)) throw new ForbiddenError('Sólo un administrador puede vincular carpetas')
    let status: DriveFolderMatchStatus = 'none'
    let propertyId: string | null = null
    if (input.ignore) status = 'ignored'
    else if (input.property_id) {
      const property = await this.properties.findById(input.property_id, input.org_id)
      if (!property) throw new NotFoundError('Propiedad', input.property_id)
      propertyId = property.id
      status = 'manual'
    }
    const ok = await this.folders.setProperty(input.folder_id, input.org_id, propertyId, status)
    if (!ok) throw new NotFoundError('Carpeta', input.folder_id)
    return { folder_id: input.folder_id, property_id: propertyId, match_status: status }
  }
}

/** Tope de lecturas con IA del botón "Revisar carpeta ahora": responde en segundos, no en minutos. */
export const DRIVE_AI_FILES_ON_DEMAND = 10

/** Botón "Revisar carpeta ahora" de la ficha: el agente de la propiedad o un admin. */
export class SyncPropertyDriveDocumentsUseCase {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly sync: Pick<SyncDriveDocumentsUseCase, 'execute'>,
  ) {}

  async execute(actor: DocPortalActor, propertyId: string): Promise<SyncDriveOrgResult> {
    const property = await this.properties.findById(propertyId, actor.org_id)
    if (!property) throw new NotFoundError('Propiedad', propertyId)
    if (!canManagePropertyDocs(actor, property)) {
      throw new ForbiddenError('Sólo el agente de la propiedad o un administrador pueden revisar su documentación')
    }
    const [result] = await this.sync.execute({ orgId: actor.org_id, propertyId, maxAiFiles: DRIVE_AI_FILES_ON_DEMAND })
    return result!
  }
}
