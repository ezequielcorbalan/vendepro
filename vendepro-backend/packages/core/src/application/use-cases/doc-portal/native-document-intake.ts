import type {
  DocumentIntakeFields,
  DocumentIntakeFile,
  DocumentIntakeFinish,
  DocumentIntakeGateway,
  DocumentIntakeResult,
} from '../../ports/services/document-intake-gateway'
import type { DocumentClassification, DocumentClassifier } from '../../ports/services/document-classifier'
import type { CloudDocumentStorage } from '../../ports/services/cloud-document-storage'
import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { DocsEngine, DocsIntegrationConfig } from '../../../domain/entities/doc-portal'
import { Notification } from '../../../domain/entities/notification'
import { DOC_TYPE_LABELS, propertyFolderName, storedDocumentName } from '../../../domain/rules/document-checklist'

/** Nube autenticada de una org + su carpeta raíz, o null si no la conectó. */
export interface OrgCloudStorageProvider {
  forOrg(orgId: string): Promise<{ storage: CloudDocumentStorage; rootFolderId: string } | null>
}

/**
 * Motor propio: VendéPro clasifica con IA y guarda en la nube de la
 * inmobiliaria, sin n8n. Mismo contrato que el gateway de n8n, así el portal
 * y el escáner no se enteran de cuál está activo.
 */
export class NativeDocumentIntakeGateway implements DocumentIntakeGateway {
  constructor(
    private readonly classifier: DocumentClassifier,
    private readonly cloud: OrgCloudStorageProvider,
    private readonly notifications: NotificationRepository,
    private readonly ids: IdGenerator,
  ) {}

  async upload(_config: DocsIntegrationConfig, file: DocumentIntakeFile, fields: DocumentIntakeFields): Promise<DocumentIntakeResult> {
    const cloud = await this.cloud.forOrg(fields.org_id).catch((err) => {
      console.error('[native-intake] no se pudo abrir la nube de la org', err)
      return null
    })
    if (!cloud) return failure('La carga de documentación no está disponible en este momento')

    // Si la IA falla, el archivo igual se guarda: queda "a revisar" y el
    // propietario no tiene que volver a subirlo.
    let c: DocumentClassification
    try {
      c = await this.classifier.classify({
        data: file.data,
        mimeType: file.type,
        fileName: file.name,
        declaredType: fields.declared_type ?? null,
      })
    } catch (err) {
      console.error('[native-intake] clasificación falló', err)
      c = { docType: 'otro', issuedAt: null, authorization: null, observations: 'No se pudo leer automáticamente' }
    }

    try {
      const folder = await cloud.storage.ensurePropertyFolder({
        rootFolderId: cloud.rootFolderId,
        propertyId: fields.property_id,
        name: propertyFolderName(fields.direccion),
      })
      const uploaded = await cloud.storage.upload({
        folderId: folder.id,
        name: storedDocumentName(c.docType, c.issuedAt, file.name),
        mimeType: file.type || 'application/octet-stream',
        data: file.data,
      })
      const recognized = c.docType !== 'otro'
      return {
        ok: true,
        error: null,
        doc_type: c.docType,
        doc_label: recognized ? DOC_TYPE_LABELS[c.docType] : null,
        recognized,
        issued_at: c.issuedAt,
        drive_file_id: uploaded.id,
        drive_file_url: uploaded.url,
        drive_folder_url: folder.url,
        observations: c.observations,
        authorization: c.authorization,
      }
    } catch (err) {
      console.error('[native-intake] no se pudo guardar en la nube', err)
      return failure('No pudimos guardar el archivo, probá de nuevo')
    }
  }

  /** Aviso en la campana del agente con lo que falta. */
  async finish(_config: DocsIntegrationConfig, ctx: DocumentIntakeFinish): Promise<void> {
    if (!ctx.agentId) return
    try {
      await this.notifications.save(
        Notification.create({
          id: this.ids.generate(),
          org_id: ctx.orgId,
          user_id: ctx.agentId,
          kind: 'system',
          title: `El propietario de ${ctx.address} terminó de mandar documentación`,
          body: ctx.missing.length > 0 ? `Todavía falta: ${ctx.missing.join(', ')}` : 'Está todo lo requerido.',
          link_url: `/propiedades/${ctx.propertyId}`,
          read: false,
        }),
      )
    } catch (err) {
      console.error('[native-intake] no se pudo avisar al agente', err)
    }
  }
}

/** Elige el gateway según el motor configurado en la org. */
export class EngineRoutingIntakeGateway implements DocumentIntakeGateway {
  constructor(private readonly byEngine: Partial<Record<DocsEngine, DocumentIntakeGateway>>) {}

  private pick(config: DocsIntegrationConfig): DocumentIntakeGateway | null {
    return this.byEngine[config.engine] ?? null
  }

  async upload(config: DocsIntegrationConfig, file: DocumentIntakeFile, fields: DocumentIntakeFields): Promise<DocumentIntakeResult> {
    const gateway = this.pick(config)
    if (!gateway) return failure('La carga de documentación no está disponible en este momento')
    return gateway.upload(config, file, fields)
  }

  async finish(config: DocsIntegrationConfig, ctx: DocumentIntakeFinish): Promise<void> {
    await this.pick(config)?.finish(config, ctx)
  }
}

function failure(error: string): DocumentIntakeResult {
  return {
    ok: false,
    error,
    doc_type: 'otro',
    doc_label: null,
    recognized: false,
    issued_at: null,
    drive_file_id: null,
    drive_file_url: null,
    drive_folder_url: null,
    observations: null,
  }
}
