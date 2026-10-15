import { DOC_TYPE_LABELS, INTERNAL_DOC_TYPES, type DocType } from './document-checklist'

/**
 * Reglas del barrido de Drive → checklist de documentación.
 * Plan: doc/documentacion-drive-plan.md.
 */

// ── Nombres que pone n8n ──────────────────────────────────────

/**
 * n8n renombra cada archivo que clasifica como "<Documento> - AAAA-MM-DD.pdf"
 * (y "(2)" si ya existe). Para esos archivos el tipo y la fecha salen del
 * nombre, sin gastar IA. "A revisar.pdf" (lo que n8n no reconoció) no trae
 * fecha y cae a la IA.
 */
const N8N_NAME = /^(.+?) - (\d{4}-\d{2}-\d{2})(?: \(\d+\))?(?:\.[a-z0-9]+)?$/i

/** Label normalizado → tipo. Los labels del catálogo, sin el paréntesis aclaratorio. */
const TYPE_BY_LABEL: Map<string, DocType> = (() => {
  const map = new Map<string, DocType>()
  for (const [type, label] of Object.entries(DOC_TYPE_LABELS) as Array<[DocType, string]>) {
    map.set(normalizeText(label.replace(/\(.*?\)/g, '')), type)
  }
  // Variantes cortas que usa el clasificador de n8n.
  map.set('autorizacion de venta', 'autorizacion_venta')
  map.set('titulo', 'titulo')
  map.set('escritura', 'titulo')
  map.set('dni', 'dni')
  map.set('dni del propietario', 'dni')
  map.set('reglamento', 'reglamento_copropiedad')
  map.set('expensas', 'liquidacion_expensas')
  map.set('liquidacion de expensas', 'liquidacion_expensas')
  map.set('abl', 'abl')
  map.set('aysa', 'aysa')
  return map
})()

export interface ParsedDocName {
  docType: DocType
  issuedAt: string
}

export function parseN8nDocName(fileName: string): ParsedDocName | null {
  const m = N8N_NAME.exec(fileName.trim())
  if (!m) return null
  const docType = TYPE_BY_LABEL.get(normalizeText(m[1]!))
  if (!docType) return null
  return { docType, issuedAt: m[2]! }
}

// ── Vencimientos ──────────────────────────────────────────────

/** Los informes de dominio e inhibición sirven 30 días desde que se emiten. */
export const INFORME_VALIDITY_DAYS = 30

export function documentValidUntil(docType: string, issuedAt: string | null | undefined): string | null {
  if (!issuedAt || !(INTERNAL_DOC_TYPES as string[]).includes(docType)) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(issuedAt)
  if (!m) return null
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + INFORME_VALIDITY_DAYS * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

// ── Autorización de venta ─────────────────────────────────────

export interface ExtractedAuthorization {
  start_date: string
  duration_days: number | null
}

export interface AuthorizationPlan {
  /** Qué escribir en la propiedad, o null si no hay que tocar nada. */
  patch: { auth_start_date: string; auth_duration_days?: number } | null
  /** La propiedad ya tiene otra fecha: se avisa, no se pisa. */
  conflict: { current: string; fromDocument: string } | null
}

/**
 * La fecha leída del documento sólo completa lo que está vacío. Si la
 * propiedad ya tiene una fecha distinta la cargó una persona: no se pisa,
 * se avisa.
 */
export function planAuthorizationUpdate(
  current: { auth_start_date: string | null; auth_duration_days: number | null },
  extracted: ExtractedAuthorization | null,
): AuthorizationPlan {
  if (!extracted?.start_date) return { patch: null, conflict: null }
  const currentStart = (current.auth_start_date ?? '').slice(0, 10)
  if (!currentStart) {
    return {
      patch: {
        auth_start_date: extracted.start_date,
        ...(extracted.duration_days ? { auth_duration_days: extracted.duration_days } : {}),
      },
      conflict: null,
    }
  }
  if (currentStart !== extracted.start_date) {
    return { patch: null, conflict: { current: currentStart, fromDocument: extracted.start_date } }
  }
  return { patch: null, conflict: null }
}

// ── Carpetas ↔ propiedades ────────────────────────────────────

/**
 * Carpetas que no son de una propiedad. Se ignoran con todo lo que tienen
 * adentro. "Sin identificar" las crea n8n cuando no reconoce la dirección.
 */
export const DEFAULT_IGNORED_FOLDERS = [
  'modelos', 'plantillas', 'revisar', 'vendidas', 'cancelados', 'downloads', 'sin identificar', 'alquileres',
]

export function isIgnoredFolderName(name: string, extra: string[] = []): boolean {
  const n = normalizeText(name)
  return [...DEFAULT_IGNORED_FOLDERS, ...extra.map(normalizeText)].some((w) => w && n.includes(w))
}

/** Palabras de relleno que no distinguen una dirección (brief de n8n §5). */
const FILLER = new Set([
  'av', 'avda', 'avenida', 'calle', 'depto', 'dpto', 'departamento', 'piso', 'uf', 'unidad', 'nro', 'n', 'no',
])

export interface NormalizedAddress {
  street: string
  number: string
  rest: string[]
}

/**
 * Parte una dirección en calle / número / resto (piso, unidad, extras).
 * Saca acentos, °/º y relleno; "2do" → "2", "3er" → "3". La coma no corta:
 * en VendéPro separa piso y unidad ("Calle 335, Piso 2, Dpto 9"). Barrio y
 * ciudad quedan en el resto, y como el resto se compara por subconjunto no
 * molestan.
 */
export function normalizeAddress(raw: string): NormalizedAddress | null {
  const tokens = normalizeText(raw.replace(/[°º]/g, ' '))
    .split(' ')
    .map((t) => t.replace(/^(\d+)(?:do|er|ro|to|vo|mo|no)$/, '$1'))
    .filter((t) => t && !FILLER.has(t))

  // El número es el primer token numérico que viene después de una palabra:
  // así "25 de Mayo 1234" no toma el 25 como altura.
  const idx = tokens.findIndex((t, i) => i > 0 && /^\d+$/.test(t) && !/^\d+$/.test(tokens[i - 1]!))
  if (idx === -1) return null
  return { street: tokens.slice(0, idx).join(' '), number: tokens[idx]!, rest: tokens.slice(idx + 1) }
}

export type FolderMatchStatus = 'auto' | 'ambiguous' | 'none'

export interface FolderMatch {
  propertyId: string | null
  status: FolderMatchStatus
}

/**
 * Busca la propiedad de una carpeta por dirección:
 * - el número tiene que coincidir exacto;
 * - la calle, por primera palabra o porque una contiene a la otra
 *   ("Av. General Inventado" ↔ "Inventado");
 * - piso/unidad como subconjunto en alguno de los dos sentidos, para no
 *   confundir "2° 9" con "5° 2".
 * Si quedan varias, gana la que coincide exacto en piso/unidad; si sigue
 * habiendo más de una, no adivina: 'ambiguous'.
 */
export function matchFolderToProperty(
  folderName: string,
  properties: Array<{ id: string; address: string | null }>,
): FolderMatch {
  const folder = normalizeAddress(folderName)
  if (!folder) return { propertyId: null, status: 'none' }

  const candidates: Array<{ id: string; exact: boolean }> = []
  for (const p of properties) {
    if (!p.address) continue
    const addr = normalizeAddress(p.address)
    if (!addr || addr.number !== folder.number || !sameStreet(addr.street, folder.street)) continue
    const a = new Set(addr.rest)
    const b = new Set(folder.rest)
    const aInB = [...a].every((t) => b.has(t))
    const bInA = [...b].every((t) => a.has(t))
    if (!aInB && !bInA) continue
    candidates.push({ id: p.id, exact: aInB && bInA })
  }

  if (candidates.length === 1) return { propertyId: candidates[0]!.id, status: 'auto' }
  if (candidates.length === 0) return { propertyId: null, status: 'none' }
  const exact = candidates.filter((c) => c.exact)
  if (exact.length === 1) return { propertyId: exact[0]!.id, status: 'auto' }
  return { propertyId: null, status: 'ambiguous' }
}

function sameStreet(a: string, b: string): boolean {
  if (!a || !b) return false
  return a.split(' ')[0] === b.split(' ')[0] || a.includes(b) || b.includes(a)
}

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
