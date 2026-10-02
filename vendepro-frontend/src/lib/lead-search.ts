/**
 * Búsqueda de la lista de leads (se filtra en el cliente).
 *
 * Antes era un `includes` literal: "11 5555-1234" no encontraba un lead
 * guardado como "+5491155551234", "nuñez" no encontraba "Núñez" y la
 * propiedad sólo se buscaba si estaba tipeada en el lead. Acá:
 *  - Teléfonos: se comparan sólo dígitos y sin prefijos argentinos
 *    (+54, 9, 0, 15), así cualquier forma de escribirlo — o un pedazo — matchea.
 *  - Texto: sin mayúsculas ni acentos, y cada palabra puede estar en un campo
 *    distinto ("juan cabildo" = nombre Juan + propiedad en Cabildo).
 *  - Propiedad: dirección/barrio del lead + propiedades vinculadas
 *    (`linked_properties`, la captada o las de interés del comprador).
 */

/** Mínimo de dígitos para buscar por teléfono: con menos matchea todo. */
const MIN_PHONE_DIGITS = 3

export function normalizeText(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Formas equivalentes de un número argentino, sólo dígitos. Ej. "+54 9 11
 * 5555-1234" → ["5491155551234", "1155551234", ...]. Se generan variantes en
 * vez de una forma canónica porque el "15" no se puede ubicar sin saber el
 * largo de la característica.
 */
export function phoneVariants(raw: string | null | undefined): string[] {
  let d = (raw || '').replace(/\D/g, '')
  if (!d) return []
  const out = new Set<string>([d])
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('9') && d.length >= 11) d = d.slice(1)
  if (d.startsWith('0')) d = d.slice(1)
  out.add(d)
  // Celular con el "15" local: 11 15 5555-1234 → 11 5555-1234.
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === '15') out.add(d.slice(0, i) + d.slice(i + 2))
    }
  }
  // Tipeado sin característica pero con 15: 15 5555-1234 → 5555-1234.
  if (d.startsWith('15') && d.length === 10) out.add(d.slice(2))
  return Array.from(out)
}

function phoneMatches(queryDigits: string, phones: (string | null | undefined)[]): boolean {
  const qs = phoneVariants(queryDigits).filter(q => q.length >= MIN_PHONE_DIGITS)
  if (!qs.length) return false
  return phones.some(p => {
    const vs = phoneVariants(p)
    return vs.some(v => qs.some(q => v.includes(q)))
  })
}

export interface SearchableLead {
  full_name?: string | null
  phone?: string | null
  contact_phone?: string | null
  email?: string | null
  property_address?: string | null
  neighborhood?: string | null
  linked_properties?: string | null
  source_detail?: string | null
}

export function leadMatchesSearch(lead: SearchableLead, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!query) return true
  const phones = [lead.phone, lead.contact_phone]
  const text = normalizeText([
    lead.full_name, lead.email, lead.property_address, lead.neighborhood,
    lead.linked_properties, lead.source_detail,
  ].filter(Boolean).join(' | '))

  // Todo con pinta de teléfono ("+54 9 11 5555-1234", "5555 12"): se busca
  // como número entero, no palabra por palabra.
  if (/^[\d\s\-+().]+$/.test(query)) {
    const digits = query.replace(/\D/g, '')
    if (phoneMatches(digits, phones)) return true
    // También puede ser una altura: "Cabildo 2000" buscando "2000".
    return text.includes(normalizeText(query))
  }

  // Texto (con o sin números): cada palabra tiene que aparecer en algún campo.
  return normalizeText(query).split(/\s+/).every(token => {
    if (text.includes(token)) return true
    return /^\d+$/.test(token) && phoneMatches(token, phones)
  })
}

/** Qué mostrar como propiedad del lead en la lista. */
export function leadPropertyLabel(lead: SearchableLead): string | null {
  return lead.property_address || lead.neighborhood || lead.linked_properties || null
}
