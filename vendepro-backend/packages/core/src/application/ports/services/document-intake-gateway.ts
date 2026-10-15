import type { DocsIntegrationConfig } from '../../../domain/entities/doc-portal'

/** Campos que espera el webhook `documentacion-subir` de n8n (mismos nombres que su página). */
export interface DocumentIntakeFields {
  direccion: string
  operacion: string
  tipo: string
  sucesion: string
  nombre: string
  telefono: string
  email: string
  sid: string
  agente?: string | null
}

export interface DocumentIntakeFile {
  name: string
  type: string
  size: number
  data: Blob
}

export interface DocumentIntakeResult {
  ok: boolean
  /** Mensaje de n8n cuando ok = false. */
  error: string | null
  doc_type: string
  doc_label: string | null
  recognized: boolean
  issued_at: string | null
  drive_file_id: string | null
  drive_file_url: string | null
  drive_folder_url: string | null
  observations: string | null
}

/**
 * Motor que guarda, clasifica y registra los documentos (hoy: n8n).
 * Sin reintentos: si la llamada llegó y se perdió la respuesta, reintentar
 * duplica el archivo en Drive. El que reintenta es el propietario.
 */
export interface DocumentIntakeGateway {
  upload(config: DocsIntegrationConfig, file: DocumentIntakeFile, fields: DocumentIntakeFields): Promise<DocumentIntakeResult>
  /** Cierra la sesión: n8n arma y manda el resumen por mail. */
  finish(config: DocsIntegrationConfig, sessionId: string): Promise<void>
}
