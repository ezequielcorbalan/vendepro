import type { DocPortalLink, PropertyDocument, PropertyDocumentSource } from '../../../domain/entities/doc-portal'
import type { DriveFolder, DriveFolderMatchStatus } from '../../../domain/entities/drive-documents'

export interface DocPortalLinkRepository {
  /** Resolución pública: sin org_id, el token es el secreto. Incluye revocados. */
  findByToken(token: string): Promise<DocPortalLink | null>
  findActiveByProperty(propertyId: string, orgId: string): Promise<DocPortalLink | null>
  create(link: DocPortalLink): Promise<void>
  revoke(id: string, orgId: string, at: string): Promise<void>
  /** Suma un archivo y sella last_upload_at. */
  registerUpload(id: string, at: string): Promise<void>
  markFinished(id: string, at: string): Promise<void>
}

export interface PropertyDocumentRepository {
  listByProperty(propertyId: string, orgId: string): Promise<PropertyDocument[]>
  create(doc: PropertyDocument): Promise<void>
  /** Archivos subidos por un link desde una fecha (límite diario). */
  countByLinkSince(linkId: string, sinceIso: string): Promise<number>

  // ── Barrido de Drive (migración 063) ──
  /**
   * Archivos de Drive ya registrados en la org, por cualquier vía (portal o
   * barrido): el barrido no vuelve a leer lo que ya conoce.
   */
  listDriveIndex(orgId: string): Promise<Array<{ drive_file_id: string; drive_modified_at: string | null }>>
  listByOrgAndSource(orgId: string, source: PropertyDocumentSource): Promise<PropertyDocument[]>
  /** Alta con las columnas de la 063. Idempotente por drive_file_id. */
  createFromDrive(doc: PropertyDocument): Promise<void>
  /** El archivo cambió en Drive: se reescribe lo leído. */
  updateFromDrive(doc: PropertyDocument): Promise<void>
}

export interface DriveFolderRepository {
  listByOrg(orgId: string): Promise<DriveFolder[]>
  /** Upsert por folder_id: nombre, área, link, propiedad, estado y última lectura. */
  upsert(folder: DriveFolder): Promise<void>
  /** Vinculación hecha por una persona: queda 'manual' (o 'ignored') y el barrido no la recalcula. */
  setProperty(folderId: string, orgId: string, propertyId: string | null, status: DriveFolderMatchStatus): Promise<boolean>
}
