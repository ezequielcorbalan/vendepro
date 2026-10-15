import type { DocPortalLinkRepository, PropertyDocumentRepository } from '../../ports/repositories/doc-portal-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { ReservationRepository } from '../../ports/repositories/reservation-repository'
import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { DocumentIntakeGateway, DocumentIntakeFile } from '../../ports/services/document-intake-gateway'
import type { AuthorizationTerms } from '../../ports/services/document-classifier'
import type { Property, PropertyProps } from '../../../domain/entities/property'
import type { DocPortalLink, PropertyDocument } from '../../../domain/entities/doc-portal'
import {
  applyDocumentToDocStatus,
  computeDocChecklist,
  docTypeLabel,
  isDocType,
  summarizeDocChecklist,
  DOC_TYPE_LABELS,
  type DocChecklistSummary,
  type DocOperation,
} from '../../../domain/rules/document-checklist'
import {
  computeReservationMilestones,
  isReservationClosed,
  nextReservationMilestone,
  type ReservationMilestone,
} from '../../../domain/rules/reservation-milestones'
import { authorizationExpiry, daysUntil } from '../../../domain/rules/authorization-rules'
import { DomainError } from '../../../domain/errors/domain-error'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import { loadDocsIntegration } from './manage-doc-portal-link'

/** Mismo tope que la página de carga de n8n. */
export const DOC_PORTAL_MAX_FILE_BYTES = 15 * 1024 * 1024
/** Freno para un link filtrado: nadie manda 60 papeles de una propiedad en un día. */
export const DOC_PORTAL_MAX_FILES_PER_DAY = 60
/** Dos "ya mandé todo" seguidos no generan dos mails de resumen. */
export const DOC_PORTAL_FINISH_DEBOUNCE_MS = 2 * 60 * 1000

const ACCEPTED_MIME = /^(application\/pdf|image\/[a-z0-9.+-]+)$/i
const ACCEPTED_EXT = /\.(pdf|jpe?g|png|heic|heif|webp|gif|tiff?)$/i

/** Una propiedad vendida o archivada ya no recibe documentación. */
const CLOSED_STATUSES = ['sold', 'archived']

class DocPortalClosedError extends DomainError {
  readonly code = 'DOC_PORTAL_CLOSED'
  readonly httpStatus = 410
  constructor() {
    super('Este link ya no está activo. Pedile uno nuevo a tu agente.')
  }
}

class DocPortalRateLimitError extends DomainError {
  readonly code = 'DOC_PORTAL_RATE_LIMIT'
  readonly httpStatus = 429
  constructor() {
    super('Llegaste al límite de archivos por hoy. Probá de nuevo mañana o escribile a tu agente.')
  }
}

class DocIntakeFailedError extends DomainError {
  readonly code = 'DOC_INTAKE_FAILED'
  readonly httpStatus = 502
  constructor(message: string) {
    super(message)
  }
}

interface ResolvedLink {
  link: DocPortalLink
  property: Property
}

/**
 * Resuelve el token a un link vivo de una propiedad abierta. Token inexistente
 * → 404; revocado o propiedad cerrada → 410 (el propietario tiene que saber
 * que le pida otro link, no que "no existe").
 */
async function resolveLink(
  links: DocPortalLinkRepository,
  properties: PropertyRepository,
  token: string,
): Promise<ResolvedLink> {
  const link = token ? await links.findByToken(token) : null
  if (!link) throw new NotFoundError('Link', 'público')
  if (link.revoked_at) throw new DocPortalClosedError()
  const property = await properties.findById(link.property_id, link.org_id)
  if (!property || CLOSED_STATUSES.includes(property.status)) throw new DocPortalClosedError()
  return { link, property }
}

// ── Estado para la página /d/<token> ─────────────────────────────

export interface PublicDocPortalView {
  address: string
  operation: DocOperation
  owner_name: string | null
  org: { name: string; logo_url: string | null; brand_color: string | null }
  agent: { name: string; phone: string | null; photo_url: string | null } | null
  checklist: DocChecklistSummary
  /** Lo que ya mandó. Sin links de Drive: la carpeta es interna. */
  documents: Array<{
    id: string
    original_name: string
    doc_type: string
    doc_label: string
    recognized: boolean
    created_at: string
  }>
  limits: { max_file_bytes: number }
  /**
   * Reserva vigente con sus hitos (cuánto falta para aceptar, boleto, escritura,
   * entrega). Sin datos del comprador: el propietario ve plazos, no a la otra parte.
   */
  reservation: {
    stage: string
    offer_amount: number | null
    offer_currency: string
    reservation_date: string | null
    milestones: ReservationMilestone[]
    next: ReservationMilestone | null
  } | null
  /** Autorización de venta: hasta cuándo rige. */
  authorization: { start_date: string; end_date: string; days_left: number | null } | null
  /** Reportes de gestión publicados (cada uno abre en /r/<slug>). */
  reports: Array<{ period_label: string; url: string; published_at: string | null }>
}

/** Fecha de hoy en Buenos Aires (YYYY-MM-DD): los plazos se cuentan por día local. */
function todayInArgentina(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export interface PublicPortalExtras {
  reservations?: ReservationRepository
  reports?: ReportRepository
  today?: () => string
}

/**
 * Portal del propietario: además de la documentación, lo que le importa de su
 * propiedad — la reserva con sus plazos, la autorización y los reportes.
 */
export class GetPublicDocPortalUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly documents: PropertyDocumentRepository,
    private readonly properties: PropertyRepository,
    private readonly orgs: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly extras: PublicPortalExtras = {},
  ) {}

  async execute(token: string): Promise<PublicDocPortalView> {
    const { link, property } = await resolveLink(this.links, this.properties, token)

    const agentId = property.agent_id ?? link.agent_id
    const [org, agent, docs, reservation, reports] = await Promise.all([
      this.orgs.findById(link.org_id),
      agentId ? this.users.findById(agentId, link.org_id).catch(() => null) : Promise.resolve(null),
      this.documents.listByProperty(property.id, link.org_id),
      // Lo extra nunca rompe el portal: si falla, la sección no aparece.
      this.extras.reservations?.findActiveByProperty(property.id, link.org_id).catch(() => null) ?? Promise.resolve(null),
      this.extras.reports?.findByProperty(property.id, link.org_id).catch(() => []) ?? Promise.resolve([]),
    ])
    if (!org) throw new NotFoundError('Link', 'público')

    const today = (this.extras.today ?? todayInArgentina)()
    let reservationView: PublicDocPortalView['reservation'] = null
    if (reservation && !isReservationClosed(reservation.stage)) {
      const milestones = computeReservationMilestones({
        stage: reservation.stage,
        accepted_at: reservation.accepted_at,
        acceptance_deadline: reservation.acceptance_deadline,
        boleto_date: reservation.boleto_date,
        escritura_date: reservation.escritura_date,
        delivery_date: reservation.delivery_date,
      }, today)
      reservationView = {
        stage: reservation.stage,
        offer_amount: reservation.offer_amount,
        offer_currency: reservation.offer_currency,
        reservation_date: reservation.reservation_date,
        milestones,
        next: nextReservationMilestone(milestones),
      }
    }
    const authEnd = authorizationExpiry(property.auth_start_date, property.auth_duration_days)

    return {
      address: property.address,
      operation: link.operation,
      owner_name: property.owner_name || null,
      org: { name: org.name, logo_url: org.logo_url, brand_color: org.brand_color },
      agent: agent ? { name: agent.full_name, phone: agent.phone ?? null, photo_url: agent.photo_url } : null,
      checklist: summarizeDocChecklist(
        computeDocChecklist({
          operation: link.operation,
          kind: link.property_kind,
          succession: link.succession,
          married: link.married,
        }),
        docs.filter((d) => d.recognized).map((d) => d.doc_type),
      ),
      documents: docs.map((d) => ({
        id: d.id,
        original_name: d.original_name,
        doc_type: d.doc_type,
        doc_label: docTypeLabel(d.doc_type),
        recognized: d.recognized,
        created_at: d.created_at,
      })),
      limits: { max_file_bytes: DOC_PORTAL_MAX_FILE_BYTES },
      reservation: reservationView,
      authorization: authEnd && property.auth_start_date
        ? { start_date: property.auth_start_date.slice(0, 10), end_date: authEnd, days_left: daysUntil(authEnd, today) }
        : null,
      reports: reports
        .filter((r) => r.status === 'published' && !!r.public_slug)
        .map((r) => ({ period_label: r.period_label, url: `/r/${r.public_slug}`, published_at: r.published_at ?? null })),
    }
  }
}

// ── Subir un archivo ─────────────────────────────────────────────

export interface UploadPortalDocumentResult {
  id: string
  doc_type: string
  doc_label: string
  recognized: boolean
}

/**
 * Un archivo por llamada, igual que la página de n8n. Todo lo que n8n necesita
 * para ubicar la carpeta (dirección, operación, tipo, agente) sale de D1, no de
 * lo que tipee el propietario.
 */
export class UploadPortalDocumentUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly documents: PropertyDocumentRepository,
    private readonly properties: PropertyRepository,
    private readonly integrations: OrgIntegrationRepository,
    private readonly gateway: DocumentIntakeGateway,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    token: string,
    file: DocumentIntakeFile,
    options: { declaredType?: string | null } = {},
  ): Promise<UploadPortalDocumentResult> {
    const { link, property } = await resolveLink(this.links, this.properties, token)

    if (!file || !file.size) throw new ValidationError('El archivo está vacío')
    if (file.size > DOC_PORTAL_MAX_FILE_BYTES) throw new ValidationError('El archivo supera 15 MB')
    if (!ACCEPTED_MIME.test(file.type || '') && !ACCEPTED_EXT.test(file.name || '')) {
      throw new ValidationError('Sólo se aceptan PDF o fotos')
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    if ((await this.documents.countByLinkSince(link.id, since)) >= DOC_PORTAL_MAX_FILES_PER_DAY) {
      throw new DocPortalRateLimitError()
    }

    const config = await loadDocsIntegration(this.integrations, link.org_id)
    if (!config) throw new DocIntakeFailedError('La carga de documentación no está disponible en este momento')

    const agentId = property.agent_id ?? link.agent_id
    const result = await this.gateway.upload(config, file, {
      direccion: property.address,
      operacion: link.operation,
      tipo: link.property_kind,
      sucesion: link.succession,
      nombre: property.owner_name ?? '',
      telefono: property.owner_phone ?? '',
      email: property.owner_email ?? '',
      sid: link.session_id,
      // Sin mapeo, n8n resuelve el agente con su planilla de responsables.
      agente: agentId ? config.agent_map[agentId] ?? null : null,
      org_id: link.org_id,
      property_id: property.id,
      declared_type: isDocType(options.declaredType) ? options.declaredType : null,
    })
    if (!result.ok) {
      throw new DocIntakeFailedError(result.error || 'No se pudo subir, probá de nuevo')
    }

    const docType = isDocType(result.doc_type) ? result.doc_type : 'otro'
    const recognized = result.recognized && docType !== 'otro'
    const now = new Date().toISOString()
    const doc: PropertyDocument = {
      id: this.ids.generate(),
      org_id: link.org_id,
      property_id: property.id,
      link_id: link.id,
      source: 'portal',
      original_name: file.name || 'archivo',
      doc_type: docType,
      recognized,
      issued_at: result.issued_at,
      drive_file_id: result.drive_file_id,
      drive_file_url: result.drive_file_url,
      drive_folder_url: result.drive_folder_url,
      observations: result.observations,
      size_bytes: file.size,
      created_at: now,
      updated_at: now,
    }
    await this.documents.create(doc)
    await this.links.registerUpload(link.id, now)

    // El archivo ya está guardado: si falla el reflejo en la ficha no hay que
    // decirle al propietario que la subida falló.
    try {
      const patch: Partial<PropertyProps> = {}
      const nextStatus = applyDocumentToDocStatus(property.doc_status_json, {
        type: recognized ? docType : 'otro',
        folderUrl: result.drive_folder_url,
      })
      if (nextStatus) patch.doc_status_json = nextStatus
      if (recognized && docType === 'autorizacion_venta') {
        Object.assign(patch, authorizationPatch(property, result.authorization ?? null))
      }
      if (Object.keys(patch).length > 0) await this.properties.update(property.id, link.org_id, patch)
    } catch (err) {
      console.error('[doc-portal] no se pudo actualizar doc_status_json', err)
    }

    return {
      id: doc.id,
      doc_type: docType,
      doc_label: recognized ? (result.doc_label || docTypeLabel(docType)) : docTypeLabel('otro'),
      recognized,
    }
  }
}

// ── "Ya mandé todo" ──────────────────────────────────────────────

export class FinishDocPortalSessionUseCase {
  constructor(
    private readonly links: DocPortalLinkRepository,
    private readonly properties: PropertyRepository,
    private readonly integrations: OrgIntegrationRepository,
    private readonly gateway: DocumentIntakeGateway,
    private readonly documents?: PropertyDocumentRepository,
  ) {}

  async execute(token: string): Promise<{ notified: boolean }> {
    const { link, property } = await resolveLink(this.links, this.properties, token)
    if (!link.last_upload_at) return { notified: false }

    const now = Date.now()
    const lastFinished = link.last_finished_at ? Date.parse(link.last_finished_at) : 0
    const lastUpload = Date.parse(link.last_upload_at)
    // Nada nuevo desde el último resumen, o el resumen se pidió hace instantes.
    if (lastFinished >= lastUpload || now - lastFinished < DOC_PORTAL_FINISH_DEBOUNCE_MS) {
      return { notified: false }
    }

    const config = await loadDocsIntegration(this.integrations, link.org_id)
    if (!config) return { notified: false }

    const docs = this.documents ? await this.documents.listByProperty(property.id, link.org_id) : []
    const checklist = summarizeDocChecklist(
      computeDocChecklist({
        operation: link.operation,
        kind: link.property_kind,
        succession: link.succession,
        married: link.married,
      }),
      docs.filter((d) => d.recognized).map((d) => d.doc_type),
    )

    await this.links.markFinished(link.id, new Date(now).toISOString())
    await this.gateway.finish(config, {
      sessionId: link.session_id,
      orgId: link.org_id,
      propertyId: property.id,
      address: property.address,
      agentId: property.agent_id ?? link.agent_id,
      missing: checklist.missing.map((t) => DOC_TYPE_LABELS[t]),
    })
    return { notified: true }
  }
}

/**
 * Plazo de la autorización leído del documento. Sólo completa lo que está
 * vacío: si alguien ya cargó la fecha a mano, manda lo cargado.
 */
export function authorizationPatch(
  property: Pick<Property, 'auth_start_date' | 'auth_duration_days'>,
  terms: AuthorizationTerms | null,
): Partial<PropertyProps> {
  if (!terms) return {}
  const patch: Partial<PropertyProps> = {}
  const valid = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d)
  if (!property.auth_start_date && valid(terms.startDate)) patch.auth_start_date = terms.startDate
  if (property.auth_duration_days == null) {
    let days = terms.durationDays && terms.durationDays > 0 ? Math.round(terms.durationDays) : null
    if (!days && valid(terms.startDate) && valid(terms.endDate)) {
      const diff = (Date.parse(terms.endDate as string) - Date.parse(terms.startDate as string)) / 86_400_000
      days = diff > 0 ? Math.round(diff) : null
    }
    if (days) patch.auth_duration_days = days
  }
  return patch
}
