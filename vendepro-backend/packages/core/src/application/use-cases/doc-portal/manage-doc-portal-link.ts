import type { DocPortalLinkRepository, PropertyDocumentRepository } from '../../ports/repositories/doc-portal-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { Property } from '../../../domain/entities/property'
import {
  DOCS_INTEGRATION_PROVIDER,
  parseDocsIntegrationConfig,
  type DocPortalLink,
  type DocsIntegrationConfig,
  type PropertyDocument,
} from '../../../domain/entities/doc-portal'
import {
  computeDocChecklist,
  summarizeDocChecklist,
  docTypeLabel,
  toDocOperation,
  toDocPropertyKind,
  DOC_OPERATIONS,
  DOC_PROPERTY_KINDS,
  DOC_SUCCESSIONS,
  type DocChecklistSummary,
  type DocOperation,
  type DocPropertyKind,
  type DocSuccession,
} from '../../../domain/rules/document-checklist'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface DocPortalActor {
  org_id: string
  user_id: string
  role: string
}

/** Admin de la org o agente a cargo de la propiedad. */
export function canManagePropertyDocs(actor: DocPortalActor, property: Property): boolean {
  return actor.role === 'admin' || actor.role === 'owner' || property.agent_id === actor.user_id
}

export async function loadDocsIntegration(
  repo: OrgIntegrationRepository,
  orgId: string,
): Promise<DocsIntegrationConfig | null> {
  const integration = await repo.findByOrgAndProvider(orgId, DOCS_INTEGRATION_PROVIDER)
  if (!integration?.enabled) return null
  return parseDocsIntegrationConfig(integration.config_json)
}

async function loadProperty(repo: PropertyRepository, actor: DocPortalActor, propertyId: string): Promise<Property> {
  const property = await repo.findById(propertyId, actor.org_id)
  if (!property) throw new NotFoundError('Propiedad', propertyId)
  if (!canManagePropertyDocs(actor, property)) {
    throw new ForbiddenError('Sólo el agente de la propiedad o un administrador pueden gestionar su documentación')
  }
  return property
}

// ── Generar / regenerar ──────────────────────────────────────────

export interface CreateDocPortalLinkInput {
  actor: DocPortalActor
  property_id: string
  operation?: DocOperation | null
  property_kind?: DocPropertyKind | null
  succession?: DocSuccession | null
  married?: boolean | null
}

/**
 * Genera el link /d/<token> de una propiedad. Si ya había uno vivo lo revoca:
 * hay un solo link por propiedad, y regenerar es la forma de cortar uno que
 * se mandó a quien no correspondía.
 */
export class CreateDocPortalLinkUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly properties: PropertyRepository,
    private readonly integrations: OrgIntegrationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateDocPortalLinkInput): Promise<DocPortalLink> {
    const property = await loadProperty(this.properties, input.actor, input.property_id)

    const config = await loadDocsIntegration(this.integrations, input.actor.org_id)
    if (!config) {
      throw new ValidationError('La carga automática de documentación no está configurada para la inmobiliaria')
    }

    const operation = input.operation ?? toDocOperation(property.operation_type)
    const kind = input.property_kind ?? toDocPropertyKind(property.property_type)
    const succession = input.succession ?? 'no'
    if (!DOC_OPERATIONS.includes(operation)) throw new ValidationError(`Operación inválida: "${operation}"`)
    if (!DOC_PROPERTY_KINDS.includes(kind)) throw new ValidationError(`Tipo de propiedad inválido: "${kind}"`)
    if (!DOC_SUCCESSIONS.includes(succession)) throw new ValidationError(`Sucesión inválida: "${succession}"`)

    const now = new Date().toISOString()
    const existing = await this.links.findActiveByProperty(property.id, input.actor.org_id)
    if (existing) await this.links.revoke(existing.id, input.actor.org_id, now)

    const link: DocPortalLink = {
      id: this.ids.generate(),
      org_id: input.actor.org_id,
      property_id: property.id,
      agent_id: input.actor.user_id,
      // 128 bits aleatorios: el link es la única credencial del propietario.
      token: this.ids.generate(),
      operation,
      property_kind: kind,
      succession,
      married: input.married ?? null,
      session_id: this.ids.generate(),
      files_count: 0,
      last_upload_at: null,
      last_finished_at: null,
      revoked_at: null,
      created_at: now,
      updated_at: now,
    }
    await this.links.create(link)
    return link
  }
}

// ── Revocar ──────────────────────────────────────────────────────

export class RevokeDocPortalLinkUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly properties: PropertyRepository,
  ) {}

  async execute(actor: DocPortalActor, propertyId: string): Promise<{ revoked: boolean }> {
    const property = await loadProperty(this.properties, actor, propertyId)
    const existing = await this.links.findActiveByProperty(property.id, actor.org_id)
    if (!existing) return { revoked: false }
    await this.links.revoke(existing.id, actor.org_id, new Date().toISOString())
    return { revoked: true }
  }
}

// ── Vista interna (CRM) ──────────────────────────────────────────

export interface PropertyDocumentView extends PropertyDocument {
  doc_label: string
}

export interface PropertyDocumentsView {
  /** false si la org no configuró la integración: no se puede generar el link. */
  enabled: boolean
  link: DocPortalLink | null
  checklist: DocChecklistSummary | null
  documents: PropertyDocumentView[]
}

export class GetPropertyDocumentsUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly documents: PropertyDocumentRepository,
    private readonly properties: PropertyRepository,
    private readonly integrations: OrgIntegrationRepository,
  ) {}

  async execute(actor: DocPortalActor, propertyId: string): Promise<PropertyDocumentsView> {
    const property = await this.properties.findById(propertyId, actor.org_id)
    if (!property) throw new NotFoundError('Propiedad', propertyId)

    const [config, link, docs] = await Promise.all([
      loadDocsIntegration(this.integrations, actor.org_id),
      this.links.findActiveByProperty(property.id, actor.org_id),
      this.documents.listByProperty(property.id, actor.org_id),
    ])

    const checklist = link
      ? summarizeDocChecklist(
          computeDocChecklist({
            operation: link.operation,
            kind: link.property_kind,
            succession: link.succession,
            married: link.married,
          }),
          docs.filter((d) => d.recognized).map((d) => d.doc_type),
        )
      : null

    return {
      enabled: !!config,
      link,
      checklist,
      documents: docs.map((d) => ({ ...d, doc_label: docTypeLabel(d.doc_type) })),
    }
  }
}
