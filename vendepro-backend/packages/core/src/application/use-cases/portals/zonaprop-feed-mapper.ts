/**
 * Feed XML para portales inmobiliarios (ZonaProp / Argenprop / MELI).
 *
 * ZonaProp no tiene API de publicación: la vía oficial es exponer una URL
 * pública con este XML y cargarla en el Panel del Anunciante. El portal la
 * crawlea cada N horas y sincroniza altas, bajas y cambios de precio.
 *
 * ─── IMPORTANTE sobre los nombres de tag ───────────────────────────────
 * `TAGS` de abajo es la estructura genérica <ads><ad> que usan los
 * agregadores de la región. Navent entrega a cada anunciante un PDF de
 * spec con SUS nombres exactos y sus tablas de códigos (property_type,
 * operation_type). Cuando tengas ese PDF, se ajusta SOLO este archivo:
 * ningún otro módulo conoce los nombres de tag.
 * ───────────────────────────────────────────────────────────────────────
 */

/** Nombres de tag del feed. Único punto a tocar al ajustar contra la spec. */
export const TAGS = {
  root: 'ads',
  item: 'ad',
  id: 'external_id',
  title: 'title',
  description: 'description',
  operation: 'operation_type',
  propertyType: 'property_type',
  price: 'price',
  currency: 'currency',
  expenses: 'expenses',
  expensesCurrency: 'expenses_currency',
  address: 'address',
  neighborhood: 'neighborhood',
  city: 'city',
  province: 'state',
  postalCode: 'postal_code',
  latitude: 'latitude',
  longitude: 'longitude',
  rooms: 'rooms',
  bathrooms: 'bathrooms',
  totalArea: 'total_area',
  coveredArea: 'covered_area',
  parking: 'parking_spaces',
  antiquity: 'age',
  photos: 'pictures',
  photo: 'picture',
  photoUrl: 'picture_url',
  photoOrder: 'picture_order',
  contact: 'contact',
  contactName: 'contact_name',
  contactEmail: 'contact_email',
  contactPhone: 'contact_phone',
  publicUrl: 'url',
  updatedAt: 'last_update',
} as const

/** Códigos de tipo de propiedad de Navent. Confirmar contra la spec. */
export const PROPERTY_TYPE_MAP: Record<string, string> = {
  departamento: 'Departamento',
  casa: 'Casa',
  ph: 'PH',
  local: 'Local comercial',
  terreno: 'Terreno',
  oficina: 'Oficina',
}

export const OPERATION_MAP: Record<string, string> = {
  venta: 'Venta',
  alquiler: 'Alquiler',
  alquiler_temporario: 'Alquiler temporario',
}

export interface FeedProperty {
  id: string
  title: string | null
  description: string | null
  operation_type: string | null
  property_type: string
  address: string
  neighborhood: string
  city: string
  province: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  rooms: number | null
  bathrooms: number | null
  size_m2: number | null
  covered_m2: number | null
  parking_spaces: number | null
  antiquity_years: number | null
  expenses: number | null
  expenses_currency: string | null
  asking_price: number | null
  currency: string
  photos: string[]
  updated_at: string
  public_slug: string
}

export interface FeedAdvertiser {
  name: string
  email: string | null
  phone: string | null
}

export interface BuildFeedInput {
  properties: FeedProperty[]
  advertiser: FeedAdvertiser
  /** Base del sitio público, sin barra final. Ej: https://www.marcelagenta.com */
  publicBaseUrl: string
}

/** Escapa los 5 caracteres que XML 1.0 no admite en texto/atributos. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Quita los caracteres de control que XML 1.0 prohíbe (todo < 0x20 salvo
 * tab/LF/CR). D1 guarda lo que le mandan: una descripción pegada desde Word
 * puede traer un 0x0B y romper el parser del portal con el feed entero.
 */
export function sanitizeXmlText(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  return `<${name}>${escapeXml(sanitizeXmlText(String(value)))}</${name}>`
}

function cdata(name: string, value: string | null | undefined): string {
  if (!value) return ''
  // `]]>` dentro del contenido cerraría la sección antes de tiempo.
  const safe = sanitizeXmlText(value).replace(/]]>/g, ']]]]><![CDATA[>')
  return `<${name}><![CDATA[${safe}]]></${name}>`
}

/**
 * Título de fallback cuando la propiedad no tiene uno cargado.
 * ZonaProp rechaza el aviso sin título, así que nunca devolvemos vacío.
 */
export function deriveTitle(p: FeedProperty): string {
  const type = PROPERTY_TYPE_MAP[p.property_type] ?? p.property_type
  const rooms = p.rooms ? ` ${p.rooms} ambiente${p.rooms === 1 ? '' : 's'}` : ''
  return `${type}${rooms} en ${p.neighborhood}`
}

/** Descripción de fallback: mejor un texto pobre que un aviso rechazado. */
export function deriveDescription(p: FeedProperty): string {
  const parts: string[] = [deriveTitle(p)]
  if (p.size_m2) parts.push(`${p.size_m2} m² totales`)
  if (p.covered_m2) parts.push(`${p.covered_m2} m² cubiertos`)
  if (p.bathrooms) parts.push(`${p.bathrooms} baño${p.bathrooms === 1 ? '' : 's'}`)
  if (p.parking_spaces) parts.push(`${p.parking_spaces} cochera${p.parking_spaces === 1 ? '' : 's'}`)
  parts.push(`Ubicado en ${p.address}, ${p.neighborhood}, ${p.city}.`)
  return parts.join('. ')
}

/**
 * Motivos por los que una propiedad NO puede ir al feed.
 * Devolver la lista (en vez de un booleano) permite mostrarle al usuario
 * en el CRM qué le falta a cada propiedad para publicarse.
 */
export function feedValidationErrors(p: FeedProperty): string[] {
  const errors: string[] = []
  if (!p.asking_price || p.asking_price <= 0) errors.push('Falta el precio')
  if (!p.address?.trim()) errors.push('Falta la dirección')
  if (!p.neighborhood?.trim()) errors.push('Falta el barrio')
  if (p.photos.length === 0) errors.push('Necesita al menos una foto')
  if (!OPERATION_MAP[(p.operation_type ?? 'venta').toLowerCase()]) {
    errors.push(`Tipo de operación no mapeado: "${p.operation_type}"`)
  }
  if (!PROPERTY_TYPE_MAP[p.property_type]) {
    errors.push(`Tipo de propiedad no mapeado: "${p.property_type}"`)
  }
  return errors
}

function buildAd(p: FeedProperty, advertiser: FeedAdvertiser, publicBaseUrl: string): string {
  const operation = OPERATION_MAP[(p.operation_type ?? 'venta').toLowerCase()] ?? 'Venta'
  const propertyType = PROPERTY_TYPE_MAP[p.property_type] ?? p.property_type

  const photos = p.photos
    .map((url, i) => `<${TAGS.photo}>${tag(TAGS.photoUrl, url)}${tag(TAGS.photoOrder, i + 1)}</${TAGS.photo}>`)
    .join('')

  return [
    `<${TAGS.item}>`,
    tag(TAGS.id, p.id),
    cdata(TAGS.title, p.title?.trim() || deriveTitle(p)),
    cdata(TAGS.description, p.description?.trim() || deriveDescription(p)),
    tag(TAGS.operation, operation),
    tag(TAGS.propertyType, propertyType),
    tag(TAGS.price, p.asking_price),
    tag(TAGS.currency, p.currency),
    tag(TAGS.expenses, p.expenses),
    // Sólo tiene sentido declarar la moneda de expensas si hay expensas.
    p.expenses ? tag(TAGS.expensesCurrency, p.expenses_currency ?? 'ARS') : '',
    cdata(TAGS.address, p.address),
    tag(TAGS.neighborhood, p.neighborhood),
    tag(TAGS.city, p.city),
    tag(TAGS.province, p.province ?? 'Buenos Aires'),
    tag(TAGS.postalCode, p.postal_code),
    tag(TAGS.latitude, p.latitude),
    tag(TAGS.longitude, p.longitude),
    tag(TAGS.rooms, p.rooms),
    tag(TAGS.bathrooms, p.bathrooms),
    tag(TAGS.totalArea, p.size_m2),
    tag(TAGS.coveredArea, p.covered_m2),
    tag(TAGS.parking, p.parking_spaces),
    tag(TAGS.antiquity, p.antiquity_years),
    `<${TAGS.photos}>${photos}</${TAGS.photos}>`,
    `<${TAGS.contact}>`,
    tag(TAGS.contactName, advertiser.name),
    tag(TAGS.contactEmail, advertiser.email),
    tag(TAGS.contactPhone, advertiser.phone),
    `</${TAGS.contact}>`,
    tag(TAGS.publicUrl, `${publicBaseUrl}/r/${p.public_slug}`),
    tag(TAGS.updatedAt, p.updated_at),
    `</${TAGS.item}>`,
  ].join('')
}

export interface BuildFeedResult {
  xml: string
  included: number
  /** Propiedades descartadas y por qué. Se loguea para diagnosticar. */
  skipped: Array<{ id: string; address: string; errors: string[] }>
}

/**
 * Arma el feed completo. Las propiedades inválidas se omiten en vez de
 * romper el documento: si el XML no parsea, ZonaProp descarta TODOS los
 * avisos, no sólo el que estaba mal.
 */
export function buildZonapropFeed(input: BuildFeedInput): BuildFeedResult {
  const baseUrl = input.publicBaseUrl.replace(/\/+$/, '')
  const skipped: BuildFeedResult['skipped'] = []
  const ads: string[] = []

  for (const p of input.properties) {
    const errors = feedValidationErrors(p)
    if (errors.length > 0) {
      skipped.push({ id: p.id, address: p.address, errors })
      continue
    }
    ads.push(buildAd(p, input.advertiser, baseUrl))
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<${TAGS.root}>${ads.join('')}</${TAGS.root}>`

  return { xml, included: ads.length, skipped }
}
