import type { DocType } from '../../../domain/rules/document-checklist'

export interface DocumentClassifierInput {
  /** PDF o imagen, tal cual llegó. */
  data: Blob
  mimeType: string
  fileName: string
  /** Lo que dijo el propietario que es (el escáner lo pregunta). Pista, no verdad. */
  declaredType?: DocType | null
}

/** Datos de una autorización de venta, cuando el documento lo es. */
export interface AuthorizationTerms {
  /** YYYY-MM-DD */
  startDate: string | null
  durationDays: number | null
  /** YYYY-MM-DD */
  endDate: string | null
  exclusive: boolean | null
}

export interface DocumentClassification {
  /** 'otro' si no es ninguno del catálogo o no se pudo leer. */
  docType: DocType
  /** Fecha de emisión o firma, YYYY-MM-DD. */
  issuedAt: string | null
  /** Sólo si docType = 'autorizacion_venta'. */
  authorization: AuthorizationTerms | null
  observations: string | null
}

/**
 * Lee un documento y dice cuál es del catálogo cerrado (`DOC_TYPES`). Lo usan
 * el portal (motor propio) y el barrido de carpetas de Drive.
 * Nunca tira por un documento ilegible: devuelve 'otro' con la observación.
 */
export interface DocumentClassifier {
  classify(input: DocumentClassifierInput): Promise<DocumentClassification>
}
