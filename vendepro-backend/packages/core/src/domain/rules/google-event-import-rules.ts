import type { EventTypeValue } from '../value-objects/event-type'

/**
 * Traducción de un evento de Google a un evento del CRM.
 *
 * El agente escribe en su calendario como escribe siempre ("Visita Lavalle
 * 2060", "Llamar a Gustavo"). No se le va a pedir que use un formato: el CRM
 * interpreta el título. Es heurística y a veces va a errar — por eso el tipo
 * queda editable en el CRM y el default es `otro`, que no afirma nada.
 */

/** Minúsculas y sin tildes: "Tasación" y "tasacion" son la misma palabra. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    // Marcas diacríticas combinantes, por punto de código: escritas literales
    // son invisibles en el editor y cualquier herramienta las puede romper.
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Palabras clave por tipo de evento. El orden importa: se evalúa de arriba
 * hacia abajo y gana la primera que aparece, así "visita de comprador" cae en
 * `visita_comprador` y no en la regla genérica de visita.
 */
const KEYWORD_RULES: Array<{ type: EventTypeValue; keywords: string[] }> = [
  // Antes que `visita` a secas, si no se la come la regla genérica.
  { type: 'visita_comprador', keywords: ['visita comprador', 'visita de comprador', 'muestra', 'mostrar propiedad'] },
  { type: 'visita_captacion', keywords: ['visita captacion', 'visita de captacion', 'visita'] },
  { type: 'tasacion', keywords: ['tasacion', 'tasar', 'valuacion'] },
  { type: 'firma', keywords: ['firma', 'escritura', 'boleto'] },
  { type: 'llamada', keywords: ['llamada', 'llamar', 'telefono'] },
  { type: 'reunion', keywords: ['reunion', 'meeting', 'entrevista'] },
  { type: 'seguimiento', keywords: ['seguimiento', 'follow up', 'followup'] },
]

/**
 * Tipo de evento del CRM según el título. `otro` cuando nada coincide: es
 * preferible dejarlo sin clasificar a inventar una categoría, porque el tipo
 * después decide si el evento cuenta como gestión comercial.
 */
export function classifyGoogleEventType(summary: string | null | undefined): EventTypeValue {
  const text = normalizeForMatch(summary ?? '')
  if (!text) return 'otro'
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return rule.type
  }
  return 'otro'
}

/**
 * Busca cuál de los nombres conocidos aparece en el título, para vincular el
 * evento con ese lead o contacto.
 *
 * Pide nombre y apellido juntos ("Gustavo Monzón"), no sólo el nombre de pila:
 * con una cartera de cientos de contactos, "Reunión con Juan" haría match con
 * el Juan equivocado, y un vínculo errado es peor que ninguno. Si dos nombres
 * conocidos aparecen en el mismo título, gana el más largo (el más específico).
 */
export function matchNameInTitle(
  summary: string | null | undefined,
  candidates: Array<{ id: string; full_name: string }>,
): { id: string; full_name: string } | null {
  const text = normalizeForMatch(summary ?? '')
  if (!text) return null

  let best: { id: string; full_name: string } | null = null
  for (const candidate of candidates) {
    const name = normalizeForMatch(candidate.full_name)
    // Al menos dos palabras: descarta los contactos cargados sólo con nombre.
    if (name.split(/\s+/).filter(Boolean).length < 2) continue
    if (!text.includes(name)) continue
    if (!best || name.length > normalizeForMatch(best.full_name).length) best = candidate
  }
  return best
}

/**
 * Términos del título que valen como búsqueda de contacto: palabras de 3+
 * letras que no son ruido de agenda. Sirven para no traerse la cartera entera
 * a memoria: se buscan sólo los nombres plausibles del título.
 */
const TITLE_STOPWORDS = new Set([
  'con', 'para', 'por', 'del', 'los', 'las', 'una', 'uno', 'que', 'sobre',
  'visita', 'llamada', 'llamar', 'reunion', 'tasacion', 'tasar', 'firma',
  'seguimiento', 'comprador', 'propiedad', 'cliente', 'depto', 'casa', 'ph',
])

export function candidateNameTerms(summary: string | null | undefined): string[] {
  return normalizeForMatch(summary ?? '')
    .split(/[^a-z0-9ñ]+/i)
    .filter(word => word.length >= 3 && !TITLE_STOPWORDS.has(word))
    .slice(0, 5)
}
