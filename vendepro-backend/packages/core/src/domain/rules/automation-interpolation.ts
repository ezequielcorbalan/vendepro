import { readPath, type AutomationContext } from './automation-conditions'

/**
 * Interpolación de `{{variable}}` en los textos de las acciones.
 *
 * Reglas de diseño:
 *  - Una variable sin valor se reemplaza por vacío, NUNCA se renderiza
 *    `{{lead.full_name}}` crudo en un email que ve el cliente.
 *  - En contexto HTML se escapa el valor: el nombre del lead lo carga un
 *    tercero desde un formulario público, así que es input no confiable.
 *  - El fallback `{{var|texto}}` cubre el caso "Hola {{lead.first_name|}}".
 */

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g

export interface InterpolateOptions {
  /** 'html' escapa el valor; 'text' lo deja tal cual. Default: 'text'. */
  mode?: 'text' | 'html'
}

export function interpolate(
  template: string | null | undefined,
  context: AutomationContext,
  options: InterpolateOptions = {},
): string {
  if (!template) return ''
  const escape = options.mode === 'html'
  return template.replace(TOKEN_RE, (_match, key: string, fallback?: string) => {
    const value = resolve(context, key)
    const text = value === null || value === undefined || value === '' ? (fallback ?? '') : String(value)
    return escape ? escapeHtml(text) : text
  })
}

/**
 * Resuelve una variable. Además de los paths directos del contexto soporta
 * derivadas que no vale la pena precomputar en cada evento.
 */
function resolve(context: AutomationContext, key: string): unknown {
  const direct = readPath(context, key)
  if (direct !== undefined && direct !== null) return direct

  // `*.first_name` se deriva del nombre completo si no vino explícito.
  if (key.endsWith('.first_name')) {
    const full = readPath(context, key.replace(/\.first_name$/, '.full_name'))
    return typeof full === 'string' ? firstName(full) : undefined
  }
  return undefined
}

function firstName(full: string): string {
  const trimmed = full.trim()
  if (trimmed.length === 0) return ''
  return trimmed.split(/\s+/)[0]
}

/** Tokens presentes en un texto — el editor los usa para avisar de variables inválidas. */
export function extractTokens(template: string | null | undefined): string[] {
  if (!template) return []
  const found = new Set<string>()
  for (const match of template.matchAll(TOKEN_RE)) found.add(match[1])
  return [...found]
}

/**
 * Variables usadas en el texto que no están disponibles para ese trigger.
 * Se reporta como advertencia al guardar, no como error: una variable de más
 * renderiza vacío, no rompe el envío.
 */
export function unknownTokens(template: string | null | undefined, available: readonly string[]): string[] {
  const set = new Set(available)
  return extractTokens(template).filter((t) => !set.has(t) && !isDerivable(t, set))
}

function isDerivable(token: string, available: Set<string>): boolean {
  return token.endsWith('.first_name') && available.has(token.replace(/\.first_name$/, '.full_name'))
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Versión texto plano de un cuerpo HTML, para el `text` del email.
 * Resend exige ambos: sin `text` el mail puntúa peor en los filtros de spam.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    // Los bloques de párrafo separan con línea en blanco; las filas de lista
    // y de tabla, con salto simple.
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
    .replace(/<\/(li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
