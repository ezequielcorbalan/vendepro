import type { DocPortalLink, PropertyDocument } from '../../../domain/entities/doc-portal'

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
}
