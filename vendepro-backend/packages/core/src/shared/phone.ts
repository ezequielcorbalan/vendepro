/**
 * Normalización de teléfonos argentinos.
 *
 * Existe porque el mismo número entra escrito de cinco formas distintas: lo
 * que carga el agente a mano ("11 5555-1234"), lo que manda un portal
 * ("+5491155551234") y lo que devuelve WhatsApp (el jid "5491155551234").
 * Para encontrar al contacto de un mensaje entrante hay que compararlos sin
 * importar la forma.
 */

/** Sólo los dígitos: saca espacios, guiones, paréntesis, '+' y puntos. */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Formas equivalentes de un número argentino, en dígitos.
 *
 * Se devuelven variantes en vez de una forma canónica porque el "15" no se
 * puede ubicar sin saber el largo de la característica: 11 (CABA) son dos
 * dígitos, pero 2241 son cuatro.
 */
export function phoneVariants(raw: string | null | undefined): string[] {
  let d = phoneDigits(raw)
  if (!d) return []
  const out = new Set<string>([d])

  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('54')) d = d.slice(2)
  // El 9 de los celulares argentinos en formato internacional.
  if (d.startsWith('9') && d.length >= 11) d = d.slice(1)
  // El 0 de la característica en formato nacional.
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

/**
 * La forma nacional sin prefijos: característica + abonado (10 dígitos en la
 * mayoría del país). Es la que conviene guardar y con la que se compara.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const variants = phoneVariants(raw)
  if (variants.length === 0) return null
  // La más corta que siga pareciendo un número completo; si ninguna llega a
  // 10, la más corta igual (un fijo viejo, una extensión).
  const completas = variants.filter(v => v.length >= 10)
  const candidatas = completas.length > 0 ? completas : variants
  return candidatas.reduce((a, b) => (b.length < a.length ? b : a))
}

/** ¿Dos teléfonos escritos distinto son el mismo? */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const va = phoneVariants(a)
  const vb = phoneVariants(b)
  if (va.length === 0 || vb.length === 0) return false
  return va.some(x => vb.some(y => x === y || (x.length >= 8 && y.endsWith(x)) || (y.length >= 8 && x.endsWith(y))))
}
