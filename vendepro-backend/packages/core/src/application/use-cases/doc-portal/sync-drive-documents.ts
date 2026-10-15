import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'
import type { DriveFolderRepository, PropertyDocumentRepository } from '../../ports/repositories/doc-portal-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { DocumentStore, DriveItem } from '../../ports/services/document-store'
import type { DocumentClassifier } from '../../ports/services/document-classifier'
import type { Property } from '../../../domain/entities/property'
import type { PropertyDocument } from '../../../domain/entities/doc-portal'
import { Notification } from '../../../domain/entities/notification'
import {
  DRIVE_DOCS_PROVIDER,
  parseDriveDocsConfig,
  type DriveDocsConfig,
  type DriveFolder,
} from '../../../domain/entities/drive-documents'
import { applyDocumentToDocStatus, type DocType } from '../../../domain/rules/document-checklist'
import {
  documentValidUntil,
  isIgnoredFolderName,
  matchFolderToProperty,
  parseN8nDocName,
  planAuthorizationUpdate,
  type ExtractedAuthorization,
} from '../../../domain/rules/drive-documents'
import { ValidationError } from '../../../domain/errors/validation-error'

/** Mismo tope que el portal y que n8n: arriba de esto no se descarga. */
export const DRIVE_MAX_FILE_BYTES = 15 * 1024 * 1024
/**
 * Archivos que se leen con IA por pasada. El backfill (cientos de archivos)
 * se completa en varias noches sin pasarse de los subrequests ni del CPU del
 * worker: lo que no entra queda para la próxima, porque no queda registrado.
 */
export const DRIVE_AI_FILES_PER_RUN = 25

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'

export interface SyncDriveDocumentsInput {
  /** Sin orgId: todas las orgs con la integración habilitada (cron). */
  orgId?: string
  /** Sólo las carpetas vinculadas a esta propiedad (botón "Revisar carpeta"). */
  propertyId?: string
  maxAiFiles?: number
  now?: Date
}

export interface SyncDriveOrgResult {
  org_id: string
  read_only: boolean
  folders: number
  matched: number
  ambiguous: number
  unmatched: number
  /** Archivos registrados o re-leídos en esta pasada. */
  documents: number
  by_name: number
  by_ai: number
  unreadable: number
  /** Quedaron para la próxima pasada (tope de IA o error del clasificador). */
  pending: number
  properties_updated: number
  authorizations_filled: number
  conflicts: number
}

interface Classified {
  docType: DocType
  issuedAt: string | null
  authorization: ExtractedAuthorization | null
  observations: string | null
  classifiedBy: 'nombre_n8n' | 'ia' | 'sin_leer'
}

export interface SyncDriveDocumentsDeps {
  integrations: OrgIntegrationRepository
  store: DocumentStore
  /** null = sin IA configurada: sólo se registra lo que trae nombre de n8n. */
  classifier: DocumentClassifier | null
  folders: DriveFolderRepository
  documents: PropertyDocumentRepository
  properties: PropertyRepository
  notifications: NotificationRepository
  ids: IdGenerator
}

/**
 * Barrido de la unidad compartida de documentación → checklist de cada
 * propiedad. Plan: doc/documentacion-drive-plan.md.
 *
 * 1. Lista todo el árbol (una sola consulta paginada).
 * 2. Vincula cada carpeta de propiedad con su propiedad por dirección
 *    (nunca adivina: dos candidatas = 'ambiguous'; lo manual no se recalcula).
 * 3. Registra los archivos nuevos o cambiados, de lo barato a lo caro: nombre
 *    que puso n8n → IA → "sin leer" si pesa demasiado. Idempotente por
 *    drive_file_id: lo que ya está registrado (también lo que subió el portal)
 *    no se vuelve a leer.
 * 4. Si la org no está en modo sólo lectura, deriva de lo registrado el
 *    checklist de cada propiedad y completa la fecha de la autorización si
 *    estaba vacía. Esta parte se recalcula entera en cada pasada, así que
 *    apagar el modo sólo lectura aplica también lo registrado antes.
 */
export class SyncDriveDocumentsUseCase {
  constructor(private readonly deps: SyncDriveDocumentsDeps) {}

  async execute(input: SyncDriveDocumentsInput = {}): Promise<SyncDriveOrgResult[]> {
    const now = input.now ?? new Date()
    const maxAi = input.maxAiFiles ?? DRIVE_AI_FILES_PER_RUN

    if (input.orgId) {
      const integration = await this.deps.integrations.findByOrgAndProvider(input.orgId, DRIVE_DOCS_PROVIDER)
      const config = integration?.enabled ? parseDriveDocsConfig(integration.config_json) : null
      if (!config) throw new ValidationError('La org no tiene configurado el Drive de documentación')
      return [await this.syncOrg(input.orgId, config, { now, maxAi, propertyId: input.propertyId })]
    }

    const results: SyncDriveOrgResult[] = []
    for (const integration of await this.deps.integrations.findEnabledByProvider(DRIVE_DOCS_PROVIDER)) {
      const config = parseDriveDocsConfig(integration.config_json)
      if (!config) continue
      // Una org mal configurada (unidad no compartida, id equivocado) no frena a las demás.
      try {
        results.push(await this.syncOrg(integration.org_id, config, { now, maxAi }))
      } catch (err) {
        console.error(`[drive-docs] sync de ${integration.org_id} falló (aislado):`, (err as Error)?.message ?? err)
      }
    }
    return results
  }

  private async syncOrg(
    orgId: string,
    config: DriveDocsConfig,
    opts: { now: Date; maxAi: number; propertyId?: string },
  ): Promise<SyncDriveOrgResult> {
    const nowIso = opts.now.toISOString()
    const result: SyncDriveOrgResult = {
      org_id: orgId, read_only: config.read_only, folders: 0, matched: 0, ambiguous: 0, unmatched: 0,
      documents: 0, by_name: 0, by_ai: 0, unreadable: 0, pending: 0,
      properties_updated: 0, authorizations_filled: 0, conflicts: 0,
    }

    const items = await this.deps.store.listTree(config.shared_drive_id)
    const tree = buildTree(items, config)
    const properties = await this.deps.properties.findByOrg(orgId)
    const propertyById = new Map(properties.map((p) => [p.id, p]))

    // ── 2. Carpetas ↔ propiedades ──
    const known = new Map((await this.deps.folders.listByOrg(orgId)).map((f) => [f.folder_id, f]))
    const linked = new Map<string, DriveFolder>()
    for (const { folder, area } of tree.propertyFolders) {
      const prev = known.get(folder.id)
      const keep = prev && (prev.match_status === 'manual' || prev.match_status === 'ignored')
      const match = keep
        ? { propertyId: prev.property_id, status: prev.match_status }
        : matchFolderToProperty(folder.name, properties.map((p) => ({ id: p.id, address: p.address })))
      const row: DriveFolder = {
        folder_id: folder.id,
        org_id: orgId,
        area: area.name,
        name: folder.name,
        web_url: folder.webViewLink,
        property_id: match.propertyId,
        match_status: match.status,
        last_scanned_at: nowIso,
      }
      await this.deps.folders.upsert(row)
      result.folders += 1
      if (row.property_id && row.match_status !== 'ignored') {
        result.matched += 1
        linked.set(row.folder_id, row)
      } else if (row.match_status === 'ambiguous') result.ambiguous += 1
      else if (row.match_status === 'none') result.unmatched += 1
    }

    // ── 3. Archivos nuevos o cambiados ──
    const index = new Map((await this.deps.documents.listDriveIndex(orgId)).map((r) => [r.drive_file_id, r.drive_modified_at]))
    let aiUsed = 0
    for (const file of tree.files) {
      const folder = linked.get(tree.propertyFolderOf.get(file.id) ?? '')
      if (!folder?.property_id) continue
      if (opts.propertyId && folder.property_id !== opts.propertyId) continue

      const seen = index.has(file.id)
      const seenModified = index.get(file.id)
      // Ya registrado y sin cambios (o registrado por el portal, sin fecha de Drive).
      if (seen && (seenModified == null || seenModified === file.modifiedTime)) continue

      const classified = await this.classify(file, aiUsed < opts.maxAi)
      if (classified === 'pending') { result.pending += 1; continue }
      if (classified.classifiedBy === 'ia') aiUsed += 1
      if (classified.classifiedBy === 'nombre_n8n') result.by_name += 1
      else if (classified.classifiedBy === 'ia') result.by_ai += 1
      else result.unreadable += 1

      const doc: PropertyDocument = {
        id: this.deps.ids.generate(),
        org_id: orgId,
        property_id: folder.property_id,
        link_id: null,
        source: 'drive',
        original_name: file.name,
        doc_type: classified.docType,
        recognized: classified.docType !== 'otro',
        issued_at: classified.issuedAt,
        drive_file_id: file.id,
        drive_file_url: file.webViewLink,
        drive_folder_url: folder.web_url,
        observations: classified.observations,
        size_bytes: file.sizeBytes,
        valid_until: documentValidUntil(classified.docType, classified.issuedAt),
        extracted_json: classified.authorization ? JSON.stringify({ authorization: classified.authorization }) : null,
        classified_by: classified.classifiedBy,
        drive_modified_at: file.modifiedTime,
        created_at: nowIso,
        updated_at: nowIso,
      }
      if (seen) await this.deps.documents.updateFromDrive(doc)
      else await this.deps.documents.createFromDrive(doc)
      result.documents += 1

      // Autorización nueva con fecha distinta a la cargada: se avisa una vez,
      // cuando se lee el documento (no en cada pasada).
      const property = propertyById.get(folder.property_id)
      if (!config.read_only && property && classified.authorization) {
        const plan = planAuthorizationUpdate(
          { auth_start_date: property.auth_start_date, auth_duration_days: property.auth_duration_days },
          classified.authorization,
        )
        if (plan.conflict) {
          result.conflicts += 1
          await this.notifyConflict(orgId, property, plan.conflict)
        }
      }
    }

    // ── 4. Reflejo en las propiedades ──
    if (!config.read_only) {
      const docs = await this.deps.documents.listByOrgAndSource(orgId, 'drive')
      const byProperty = new Map<string, PropertyDocument[]>()
      for (const d of docs) {
        if (opts.propertyId && d.property_id !== opts.propertyId) continue
        const list = byProperty.get(d.property_id) ?? []
        list.push(d)
        byProperty.set(d.property_id, list)
      }
      for (const [propertyId, list] of byProperty) {
        const property = propertyById.get(propertyId)
        if (!property) continue
        const outcome = await this.applyToProperty(orgId, property, list)
        if (outcome.updated) result.properties_updated += 1
        if (outcome.authFilled) result.authorizations_filled += 1
      }
    }

    return result
  }

  private async classify(file: DriveItem, aiAvailable: boolean): Promise<Classified | 'pending'> {
    const parsed = parseN8nDocName(file.name)
    const observations = observationsFromDescription(file.description)

    // Lo que ya clasificó n8n no gasta IA. La autorización sí: el nombre trae
    // la fecha de firma, no el plazo del mandato.
    if (parsed && parsed.docType !== 'autorizacion_venta') {
      return { docType: parsed.docType, issuedAt: parsed.issuedAt, authorization: null, observations, classifiedBy: 'nombre_n8n' }
    }

    const readable = isReadableMime(file.mimeType)
    if (!readable || (file.sizeBytes ?? 0) > DRIVE_MAX_FILE_BYTES) {
      return {
        docType: parsed?.docType ?? 'otro',
        issuedAt: parsed?.issuedAt ?? null,
        authorization: null,
        observations: !readable
          ? 'Formato que no se lee automáticamente: revisalo a mano.'
          : 'Pesa más de 15 MB: no se lee automáticamente, revisalo a mano.',
        classifiedBy: 'sin_leer',
      }
    }

    if (!this.deps.classifier || !aiAvailable) return 'pending'

    try {
      const content = await this.deps.store.download(file, DRIVE_MAX_FILE_BYTES)
      if (!content) {
        return {
          docType: parsed?.docType ?? 'otro', issuedAt: parsed?.issuedAt ?? null, authorization: null,
          observations: 'No se pudo descargar para leerlo: revisalo a mano.', classifiedBy: 'sin_leer',
        }
      }
      const c = await this.deps.classifier.classify({ base64: content.base64, mimeType: content.mimeType, fileName: file.name })
      return {
        // Si n8n ya dijo qué era, su tipo manda; la IA aporta las fechas.
        docType: parsed?.docType ?? c.docType,
        issuedAt: c.issuedAt ?? parsed?.issuedAt ?? null,
        authorization: c.authorization,
        observations: c.observations ?? observations,
        classifiedBy: 'ia',
      }
    } catch (err) {
      // Sin registrar: se reintenta en la próxima pasada.
      console.error(`[drive-docs] no se pudo leer ${file.id}:`, (err as Error)?.message ?? err)
      return 'pending'
    }
  }

  private async applyToProperty(
    orgId: string,
    property: Property,
    docs: PropertyDocument[],
  ): Promise<{ updated: boolean; authFilled: boolean }> {
    const patch: Record<string, unknown> = {}

    let status = property.doc_status_json
    let statusChanged = false
    for (const d of docs) {
      const next = applyDocumentToDocStatus(status, { type: d.recognized ? d.doc_type : 'otro', folderUrl: d.drive_folder_url })
      if (next) { status = next; statusChanged = true }
    }
    if (statusChanged) patch.doc_status_json = status

    // Entre varias autorizaciones, la más nueva.
    const latest = docs
      .map((d) => parseAuthorization(d.extracted_json))
      .filter((a): a is ExtractedAuthorization => !!a)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
    const plan = planAuthorizationUpdate(
      { auth_start_date: property.auth_start_date, auth_duration_days: property.auth_duration_days },
      latest,
    )
    if (plan.patch) Object.assign(patch, plan.patch)

    if (Object.keys(patch).length === 0) return { updated: false, authFilled: false }
    await this.deps.properties.update(property.id, orgId, patch)
    return { updated: true, authFilled: !!plan.patch }
  }

  private async notifyConflict(orgId: string, property: Property, conflict: { current: string; fromDocument: string }) {
    if (!property.agent_id) return
    try {
      await this.deps.notifications.save(Notification.create({
        id: this.deps.ids.generate(),
        org_id: orgId,
        user_id: property.agent_id,
        kind: 'system',
        title: 'Autorización: la fecha de Drive no coincide',
        body: `En la carpeta de Drive, la autorización de ${property.address ?? 'la propiedad'} arranca el ${ar(conflict.fromDocument)}, `
          + `pero en VendéPro figura el ${ar(conflict.current)}. Revisá cuál es la vigente.`,
        link_url: `/propiedades/${property.id}`,
        read: false,
      }))
    } catch (err) {
      console.error('[drive-docs] no se pudo avisar el conflicto de autorización', err)
    }
  }
}

// ── Árbol de la unidad ────────────────────────────────────────

interface DriveTree {
  /** Carpetas de propiedad: hijas directas de una carpeta de área. */
  propertyFolders: Array<{ folder: DriveItem; area: DriveItem }>
  /** Archivo → carpeta de propiedad que lo contiene (a cualquier profundidad). */
  propertyFolderOf: Map<string, string>
  files: DriveItem[]
}

/**
 * Raíz de la unidad → carpetas de área (OFICINA, ANDY…) → carpeta por
 * propiedad → archivos y subcarpetas (informes/, escrituras/…). Lo que está
 * dentro de una carpeta ignorada (MODELOS, VENDIDAS…) se ignora entero.
 */
export function buildTree(items: DriveItem[], config: Pick<DriveDocsConfig, 'shared_drive_id' | 'ignore'>): DriveTree {
  const byId = new Map(items.map((i) => [i.id, i]))
  const isRoot = (id: string | null) => !id || id === config.shared_drive_id
  const isArea = (i: DriveItem | undefined) => !!i && i.isFolder && isRoot(i.parentId)

  const propertyFolders: DriveTree['propertyFolders'] = []
  for (const item of items) {
    if (!item.isFolder || isRoot(item.parentId)) continue
    const parent = byId.get(item.parentId!)
    if (!isArea(parent)) continue
    if (isIgnoredFolderName(parent!.name, config.ignore) || isIgnoredFolderName(item.name, config.ignore)) continue
    propertyFolders.push({ folder: item, area: parent! })
  }
  const propertyFolderIds = new Set(propertyFolders.map((p) => p.folder.id))

  const propertyFolderOf = new Map<string, string>()
  const files: DriveItem[] = []
  for (const item of items) {
    if (item.isFolder || item.mimeType === FOLDER_MIME) continue
    // Sube hasta encontrar la carpeta de propiedad; si cruza una carpeta
    // ignorada o llega a la raíz, el archivo no es de ninguna propiedad.
    let cur = item.parentId
    let hops = 0
    while (cur && !propertyFolderIds.has(cur) && hops < 20) {
      const node = byId.get(cur)
      if (!node || isRoot(node.parentId) || isIgnoredFolderName(node.name, config.ignore)) { cur = null; break }
      cur = node.parentId
      hops += 1
    }
    if (cur && propertyFolderIds.has(cur)) {
      propertyFolderOf.set(item.id, cur)
      files.push(item)
    }
  }
  return { propertyFolders, propertyFolderOf, files }
}

function isReadableMime(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/') || mime === GOOGLE_DOC_MIME
}

/** n8n deja "Original: <nombre> | <observaciones>" en la descripción. */
function observationsFromDescription(description: string | null): string | null {
  if (!description) return null
  const idx = description.indexOf(' | ')
  const obs = (idx >= 0 ? description.slice(idx + 3) : description).trim()
  return obs || null
}

function parseAuthorization(raw: string | null | undefined): ExtractedAuthorization | null {
  if (!raw) return null
  try {
    const a = JSON.parse(raw)?.authorization
    if (typeof a?.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.start_date)) return null
    return { start_date: a.start_date, duration_days: Number.isFinite(a.duration_days) ? a.duration_days : null }
  } catch {
    return null
  }
}

function ar(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}
