import type { DocsIntegrationConfig } from '../../../domain/entities/doc-portal'
import type { DocType } from '../../../domain/rules/document-checklist'
import type { AuthorizationTerms } from './document-classifier'

/**
 * Lo que se sabe del archivo al subirlo. Los primeros campos son los de la
 * página de n8n (mismos nombres); los de abajo los usa el motor propio.
 */
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
  org_id: string
  property_id: string
  /** Lo que eligió el propietario en el escáner, si escaneó. */
  declared_type?: DocType | null
}

export interface DocumentIntakeFile {
  name: string
  type: string
  size: number
  data: Blob
}

export interface DocumentIntakeResult {
  ok: boolean
  /** Mensaje para el propietario cuando ok = false. */
  error: string | null
  doc_type: string
  doc_label: string | null
  recognized: boolean
  issued_at: string | null
  drive_file_id: string | null
  drive_file_url: string | null
  drive_folder_url: string | null
  observations: string | null
  /** Sólo el motor propio: plazo de la autorización leído del documento. */
  authorization?: AuthorizationTerms | null
}

/** Contexto del "ya mandé todo". */
export interface DocumentIntakeFinish {
  sessionId: string
  orgId: string
  propertyId: string
  address: string
  /** A quién avisar (agente de la propiedad o el que generó el link). */
  agentId: string | null
  /** Requeridos que todavía faltan (labels). */
  missing: string[]
}

/**
 * Motor que guarda, clasifica y registra los documentos: n8n o el propio.
 * Sin reintentos: si la llamada llegó y se perdió la respuesta, reintentar
 * duplica el archivo. El que reintenta es el propietario.
 */
export interface DocumentIntakeGateway {
  upload(config: DocsIntegrationConfig, file: DocumentIntakeFile, fields: DocumentIntakeFields): Promise<DocumentIntakeResult>
  /** Cierra la sesión: avisar que el propietario terminó. */
  finish(config: DocsIntegrationConfig, ctx: DocumentIntakeFinish): Promise<void>
}
