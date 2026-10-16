/**
 * Checklist de documentación de una propiedad.
 *
 * Es el mismo cálculo que hace la página de carga de n8n (workflow
 * "Documentacion de propiedades"): los `tipo_id` son los que devuelve su
 * clasificador, así que lo que reconoce la IA se cruza directo con esta lista.
 * Si cambia la checklist allá, cambia acá.
 */

export const DOC_TYPES = [
  'autorizacion_venta',
  'titulo',
  'plano_mensura',
  'reglamento_copropiedad',
  'informe_dominio',
  'informe_inhibicion',
  'dni',
  'certificado_matrimonio',
  'testimonio',
  'liquidacion_expensas',
  'caratula_sucesorio',
  'abl',
  'factura_luz',
  'factura_gas',
  'aysa',
  'usufructo',
  // No es documentación que se le pide al propietario: leerla mueve la
  // propiedad a "Reservada" (ver reserved-property.ts).
  'reserva',
  'otro',
] as const

export type DocType = (typeof DOC_TYPES)[number]
export type DocOperation = 'venta' | 'alquiler'
export type DocPropertyKind = 'depto' | 'ph' | 'casa' | 'local' | 'otro'
/** 'nose' = el propietario no sabe si hay sucesión (valor que usa n8n). */
export type DocSuccession = 'si' | 'no' | 'nose'

export const DOC_OPERATIONS: DocOperation[] = ['venta', 'alquiler']
export const DOC_PROPERTY_KINDS: DocPropertyKind[] = ['depto', 'ph', 'casa', 'local', 'otro']
export const DOC_SUCCESSIONS: DocSuccession[] = ['si', 'no', 'nose']

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  autorizacion_venta: 'Autorización de venta firmada',
  titulo: 'Título de propiedad (escritura)',
  plano_mensura: 'Plano de mensura',
  reglamento_copropiedad: 'Reglamento de copropiedad',
  informe_dominio: 'Informe de dominio',
  informe_inhibicion: 'Informe de inhibición',
  dni: 'DNI del propietario (frente y dorso)',
  certificado_matrimonio: 'Certificado de matrimonio',
  testimonio: 'Testimonio',
  liquidacion_expensas: 'Última liquidación de expensas',
  caratula_sucesorio: 'Carátula del sucesorio',
  abl: 'Boleta de ABL',
  factura_luz: 'Factura de luz',
  factura_gas: 'Factura de gas',
  aysa: 'Factura de AySA',
  usufructo: 'Usufructo',
  reserva: 'Reserva firmada (oferta aceptada)',
  otro: 'Otro documento',
}

/**
 * Los informes de dominio e inhibición los pide la inmobiliaria (Pipefy) al
 * cargar la captación. NUNCA son tarea del propietario: se muestran aparte,
 * como trámite interno.
 */
export const INTERNAL_DOC_TYPES: DocType[] = ['informe_dominio', 'informe_inhibicion']

/** Tipos que se reconocen pero no son parte del checklist de documentación. */
export const NON_CHECKLIST_TYPES: DocType[] = ['reserva']

export interface DocChecklistInput {
  operation: DocOperation
  kind: DocPropertyKind
  succession: DocSuccession
  /** null = no se sabe. */
  married: boolean | null
}

export interface DocChecklist {
  required: DocType[]
  optional: DocType[]
  internal: DocType[]
}

export function isDocType(value: unknown): value is DocType {
  return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value)
}

export function docTypeLabel(type: string): string {
  return isDocType(type) ? DOC_TYPE_LABELS[type] : DOC_TYPE_LABELS.otro
}

export function computeDocChecklist(input: DocChecklistInput): DocChecklist {
  // En depto y PH el agua viene dentro de las expensas: no se pide AySA.
  const horizontal = input.kind === 'depto' || input.kind === 'ph'
  const required: DocType[] = []
  const optional: DocType[] = []

  if (input.operation === 'venta') {
    required.push('autorizacion_venta', 'titulo', 'plano_mensura', 'dni', 'abl', 'factura_luz')
    if (horizontal) required.push('reglamento_copropiedad', 'liquidacion_expensas')
    else required.push('aysa')
    if (input.married === true) required.push('certificado_matrimonio')
    else optional.push('certificado_matrimonio')
  } else {
    // Provisoria: falta confirmar la checklist de alquiler con la inmobiliaria.
    required.push('titulo', 'dni', 'abl', 'factura_luz')
    if (horizontal) required.push('liquidacion_expensas')
    else required.push('aysa')
  }

  optional.push('factura_gas')

  if (input.succession === 'si') required.push('testimonio', 'caratula_sucesorio')
  if (input.succession === 'nose') optional.push('testimonio', 'caratula_sucesorio')

  return {
    required,
    optional,
    internal: input.operation === 'venta' ? [...INTERNAL_DOC_TYPES] : [],
  }
}

export interface DocChecklistItem {
  type: DocType
  label: string
  received: boolean
}

export interface DocChecklistSummary {
  required: DocChecklistItem[]
  optional: DocChecklistItem[]
  internal: DocChecklistItem[]
  required_done: number
  required_total: number
  /** Requeridos que todavía no llegaron. */
  missing: DocType[]
}

export function summarizeDocChecklist(checklist: DocChecklist, receivedTypes: Iterable<string>): DocChecklistSummary {
  const received = new Set(receivedTypes)
  const item = (type: DocType): DocChecklistItem => ({
    type,
    label: DOC_TYPE_LABELS[type],
    received: received.has(type),
  })
  const required = checklist.required.map(item)
  return {
    required,
    optional: checklist.optional.map(item),
    internal: checklist.internal.map(item),
    required_done: required.filter((i) => i.received).length,
    required_total: required.length,
    missing: required.filter((i) => !i.received).map((i) => i.type),
  }
}

/** properties.property_type → tipo que entiende el checklist de n8n. */
export function toDocPropertyKind(propertyType: string | null | undefined): DocPropertyKind {
  switch (propertyType) {
    case 'departamento': return 'depto'
    case 'ph': return 'ph'
    case 'casa': return 'casa'
    case 'local': return 'local'
    default: return 'otro'
  }
}

/** properties.operation_type → operación del checklist (todo lo que no es alquiler es venta). */
export function toDocOperation(operationType: string | null | undefined): DocOperation {
  return (operationType ?? '').toLowerCase().includes('alquiler') ? 'alquiler' : 'venta'
}

// ── Puente con el checklist manual de la ficha (properties.doc_status_json) ──

/**
 * `tipo_id` → clave del checklist manual (DocChecklistWidget). Sólo los que
 * son EL MISMO documento: la boleta de ABL no es el libre deuda municipal ni
 * la liquidación de expensas es el libre deuda de expensas, así que esos van
 * como ítems propios (`doc_<tipo>`) en vez de tildar algo que no llegó.
 */
export const DOC_STATUS_KEY_BY_TYPE: Partial<Record<DocType, string>> = {
  autorizacion_venta: 'auth_signed',
  titulo: 'title',
  plano_mensura: 'plano_mensura',
  reglamento_copropiedad: 'reglamento',
  informe_dominio: 'informe_dominio',
  informe_inhibicion: 'informe_inhibicion',
  dni: 'dni_propietario',
  certificado_matrimonio: 'cert_matrimonio',
}

type DocStatusState = 'done' | 'na' | 'pending'

interface DocStatusData {
  status: Record<string, DocStatusState>
  cloud_url?: string
  custom?: Array<{ key: string; label: string }>
  hidden?: string[]
}

function parseDocStatus(raw: string | null | undefined): DocStatusData {
  if (!raw) return { status: {} }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { status: {} }
    if ('status' in parsed) {
      return {
        status: parsed.status && typeof parsed.status === 'object' ? { ...parsed.status } : {},
        cloud_url: typeof parsed.cloud_url === 'string' ? parsed.cloud_url : '',
        custom: Array.isArray(parsed.custom) ? [...parsed.custom] : [],
        hidden: Array.isArray(parsed.hidden) ? [...parsed.hidden] : [],
      }
    }
    // Formato viejo: mapa plano de estados.
    return { status: { ...parsed } }
  } catch {
    return { status: {} }
  }
}

/**
 * Refleja un documento recibido en el checklist manual de la propiedad.
 * Devuelve el JSON nuevo, o null si no cambió nada.
 *
 * Nunca pisa lo que marcó una persona: sólo pasa ítems de pendiente a hecho.
 * Un 'na' (no aplica) o un ítem oculto a mano se respetan.
 */
export function applyDocumentToDocStatus(
  raw: string | null | undefined,
  doc: { type: string; folderUrl?: string | null },
): string | null {
  const data = parseDocStatus(raw)
  let changed = false

  if (isDocType(doc.type) && doc.type !== 'otro' && !NON_CHECKLIST_TYPES.includes(doc.type)) {
    let key = DOC_STATUS_KEY_BY_TYPE[doc.type]
    if (!key) {
      key = `doc_${doc.type}`
      const custom = data.custom ?? []
      if (!custom.some((c) => c.key === key)) {
        custom.push({ key, label: DOC_TYPE_LABELS[doc.type] })
        data.custom = custom
        changed = true
      }
    }
    const current = data.status[key]
    if (current === undefined || current === 'pending') {
      data.status[key] = 'done'
      changed = true
    }
  }

  if (doc.folderUrl && !data.cloud_url) {
    data.cloud_url = doc.folderUrl
    changed = true
  }

  if (!changed) return null
  return JSON.stringify({
    status: data.status,
    cloud_url: data.cloud_url ?? '',
    custom: data.custom ?? [],
    hidden: data.hidden ?? [],
  })
}

// ── Nombres en la nube (motor propio) ─────────────────────────────

/** Saca lo que Drive/Windows no aceptan en un nombre y recorta. */
function cleanName(value: string, max = 120): string {
  return value.replace(/[\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * Nombre con el que queda el archivo: el documento reconocido y su fecha
 * ("Título de propiedad - 2010-08-10.pdf"), igual que renombra n8n. Si no se
 * reconoció, "A revisar - <nombre original>" para que se vea a simple vista.
 */
export function storedDocumentName(docType: string, issuedAt: string | null, originalName: string): string {
  const ext = (originalName.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? '').toLowerCase()
  if (!isDocType(docType) || docType === 'otro') {
    const base = cleanName(originalName.replace(/\.[a-z0-9]{2,5}$/i, '')) || 'documento'
    return `A revisar - ${base}${ext}`
  }
  const label = cleanName(DOC_TYPE_LABELS[docType].replace(/\s*\(.*?\)\s*/g, ' '))
  const date = issuedAt && /^\d{4}-\d{2}-\d{2}$/.test(issuedAt) ? ` - ${issuedAt}` : ''
  return `${label}${date}${ext}`
}

/** Nombre de la carpeta de la propiedad: la dirección tal cual la cargó el agente. */
export function propertyFolderName(address: string): string {
  return cleanName(address) || 'Propiedad sin dirección'
}
