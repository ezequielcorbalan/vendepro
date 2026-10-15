export interface CloudFolder {
  id: string
  url: string
}

export interface CloudFile {
  id: string
  url: string
}

/**
 * La nube de la inmobiliaria donde quedan los documentos (hoy Google Drive;
 * OneDrive o Dropbox serían otra implementación). Cada instancia ya está
 * autenticada contra la cuenta de UNA org.
 */
export interface CloudDocumentStorage {
  /** Carpeta raíz de VendéPro en la nube de la org; la crea si no existe. */
  ensureRootFolder(name: string): Promise<CloudFolder>
  /**
   * Carpeta de la propiedad. La busca por su id de VendéPro (no por nombre: la
   * pueden renombrar) y la crea si no existe.
   */
  ensurePropertyFolder(input: { rootFolderId: string; propertyId: string; name: string }): Promise<CloudFolder>
  upload(input: { folderId: string; name: string; mimeType: string; data: Blob }): Promise<CloudFile>
}
