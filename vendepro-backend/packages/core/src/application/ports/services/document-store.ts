/**
 * Lectura de la unidad compartida donde viven las carpetas de documentación.
 * El adapter de Google Drive usa una credencial de SÓLO LECTURA: este puerto
 * no tiene, a propósito, ninguna operación que escriba.
 */
export interface DriveItem {
  id: string
  name: string
  mimeType: string
  /** Carpeta que lo contiene; para lo que está en la raíz es el id de la unidad. */
  parentId: string | null
  isFolder: boolean
  sizeBytes: number | null
  modifiedTime: string
  webViewLink: string | null
  description: string | null
}

export interface DownloadedFile {
  base64: string
  mimeType: string
}

export interface DocumentStore {
  /** Todo el árbol de la unidad (carpetas y archivos, sin papelera). */
  listTree(sharedDriveId: string): Promise<DriveItem[]>
  /**
   * Contenido del archivo. Los Google Docs se exportan a PDF. null si pesa
   * más de `maxBytes` o no es un formato legible.
   */
  download(item: DriveItem, maxBytes: number): Promise<DownloadedFile | null>
}
