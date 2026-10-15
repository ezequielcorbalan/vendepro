// Portal de documentación del propietario (/d/<token>).
// El cálculo del checklist vive en el backend (core/domain/rules/document-checklist):
// acá sólo los tipos de lo que devuelven las APIs y las opciones de los formularios.

export type DocOperation = 'venta' | 'alquiler'
export type DocPropertyKind = 'depto' | 'ph' | 'casa' | 'local' | 'otro'
export type DocSuccession = 'si' | 'no' | 'nose'

export interface DocChecklistItem {
  type: string
  label: string
  received: boolean
}

export interface DocChecklistSummary {
  required: DocChecklistItem[]
  optional: DocChecklistItem[]
  internal: DocChecklistItem[]
  required_done: number
  required_total: number
  missing: string[]
}

export interface PublicDocPortal {
  address: string
  operation: DocOperation
  owner_name: string | null
  org: { name: string; logo_url: string | null; brand_color: string | null }
  agent: { name: string; phone: string | null; photo_url: string | null } | null
  checklist: DocChecklistSummary
  documents: Array<{
    id: string
    original_name: string
    doc_type: string
    doc_label: string
    recognized: boolean
    created_at: string
  }>
  limits: { max_file_bytes: number }
  reservation: {
    stage: string
    offer_amount: number | null
    offer_currency: string
    reservation_date: string | null
    milestones: ReservationMilestone[]
    next: ReservationMilestone | null
  } | null
  authorization: { start_date: string; end_date: string; days_left: number | null } | null
  reports: Array<{ period_label: string; url: string; published_at: string | null }>
}

/** Hito de una reserva, calculado en el backend (core/domain/rules/reservation-milestones). */
export interface ReservationMilestone {
  key: 'aceptacion' | 'boleto' | 'escritura' | 'entrega'
  label: string
  date: string | null
  done: boolean
  days_left: number | null
  overdue: boolean
}

/** "Faltan 5 días", "Es hoy", "Venció hace 2 días". */
export function countdownLabel(daysLeft: number | null): string | null {
  if (daysLeft === null) return null
  if (daysLeft === 0) return 'Es hoy'
  if (daysLeft === 1) return 'Falta 1 día'
  if (daysLeft > 1) return `Faltan ${daysLeft} días`
  return daysLeft === -1 ? 'Venció ayer' : `Venció hace ${-daysLeft} días`
}

/** YYYY-MM-DD → 15/10/2026, sin pasar por zona horaria (es una fecha, no un instante). */
export function formatYmd(ymd: string | null): string {
  if (!ymd) return ''
  const [y, m, d] = ymd.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export interface DocPortalLink {
  id: string
  token: string
  public_url: string
  operation: DocOperation
  property_kind: DocPropertyKind
  succession: DocSuccession
  married: boolean | null
  files_count: number
  last_upload_at: string | null
  created_at: string
}

export interface PropertyDocument {
  id: string
  source: 'portal' | 'email' | 'drive'
  original_name: string
  doc_type: string
  doc_label: string
  recognized: boolean
  issued_at: string | null
  drive_file_url: string | null
  drive_folder_url: string | null
  created_at: string
}

export interface PropertyDocumentsView {
  enabled: boolean
  link: DocPortalLink | null
  checklist: DocChecklistSummary | null
  documents: PropertyDocument[]
}

export const DOC_OPERATION_OPTIONS = [
  { value: 'venta', label: 'Venta' },
  { value: 'alquiler', label: 'Alquiler' },
]

export const DOC_KIND_OPTIONS = [
  { value: 'depto', label: 'Departamento' },
  { value: 'ph', label: 'PH' },
  { value: 'casa', label: 'Casa' },
  { value: 'local', label: 'Local' },
  { value: 'otro', label: 'Otro' },
]

export const DOC_SUCCESSION_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
  { value: 'nose', label: 'No sabe' },
]

export const DOC_MARRIED_OPTIONS = [
  { value: 'nose', label: 'No sé' },
  { value: 'no', label: 'No' },
  { value: 'si', label: 'Sí' },
]

/** properties.property_type → tipo del checklist (mismo mapeo que el backend). */
export function toDocKind(propertyType: string | null | undefined): DocPropertyKind {
  switch (propertyType) {
    case 'departamento': return 'depto'
    case 'ph': return 'ph'
    case 'casa': return 'casa'
    case 'local': return 'local'
    default: return 'otro'
  }
}

export function toDocOperation(operationType: string | null | undefined): DocOperation {
  return (operationType ?? '').toLowerCase().includes('alquiler') ? 'alquiler' : 'venta'
}

/** URL absoluta del link para copiar y mandar por WhatsApp. */
export function docPortalAbsoluteUrl(publicUrl: string): string {
  if (typeof window === 'undefined') return publicUrl
  return `${window.location.origin}${publicUrl}`
}
