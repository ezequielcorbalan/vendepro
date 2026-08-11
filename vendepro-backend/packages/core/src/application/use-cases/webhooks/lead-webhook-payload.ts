/**
 * Helpers para el payload del webhook `lead.created`.
 * Compartidos por los distintos orígenes de lead (API de integración,
 * lead manual, sync de KiteProp) para que el objeto emitido sea idéntico.
 */

export interface AssignedAgent {
  name: string | null
  email: string | null
}

export interface LeadPropertyPayload {
  /** id de la propiedad en el sistema de origen (ej. KiteProp). */
  external_id: string | null
  /** Dirección / calle y altura. */
  address: string | null
  neighborhood: string | null
  /** venta / alquiler. */
  operation: string | null
  /** Portal de origen: zonaprop / mercadolibre / argenprop / … */
  portal: string | null
  /** Link del aviso, si existe. */
  listing_url: string | null
}

function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Arma el objeto `property` del webhook a partir de campos sueltos.
 *
 * Devuelve `null` salvo que haya un identificador concreto de propiedad
 * (`external_id` o `address`). Así una consulta que NO es por una propiedad
 * puntual (ej. una tasación web, que puede traer operación pero no un aviso)
 * queda en `property: null`, como espera el integrador.
 */
export function buildLeadProperty(fields: Partial<LeadPropertyPayload>): LeadPropertyPayload | null {
  const out: LeadPropertyPayload = {
    external_id: norm(fields.external_id),
    address: norm(fields.address),
    neighborhood: norm(fields.neighborhood),
    operation: norm(fields.operation),
    portal: norm(fields.portal),
    listing_url: norm(fields.listing_url),
  }
  const hasIdentity = out.external_id !== null || out.address !== null
  return hasIdentity ? out : null
}

/**
 * Extrae la propiedad de un item entrante de la API de integración.
 * Solo lee un objeto `property` EXPLÍCITO — no infiere desde campos planos
 * como `property_address` (que también usan las tasaciones y no son consultas
 * de aviso). El integrador señala "esto es una consulta por propiedad"
 * mandando el objeto `property`.
 */
export function propertyFromIncoming(raw: unknown): LeadPropertyPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const p = (raw as any).property
  if (!p || typeof p !== 'object') return null
  return buildLeadProperty(p as Partial<LeadPropertyPayload>)
}
