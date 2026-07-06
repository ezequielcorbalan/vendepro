// Sanitizador de HTML sin dependencias, isomórfico (corre en SSR sin DOM).
// El HTML del bloque `rich_text` lo escribe un asesor autenticado, pero se
// renderiza en la página pública /t/[slug], así que igual lo limitamos a un
// whitelist chico de tags/atributos y matamos scripts, handlers y javascript:.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span',
  'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'blockquote',
])

// Tags cuyo contenido también se descarta (no solo el markup).
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript)\b[\s\S]*?<\/\1>/gi

function sanitizeHref(raw: string): string | null {
  const value = raw.trim()
  // Permitimos http(s), mailto y tel. Cualquier otra cosa (javascript:, data:) se descarta.
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value
  if (/^\//.test(value) || /^#/.test(value)) return value
  return null
}

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html || typeof html !== 'string') return ''

  let out = html
  // 1. Eliminar tags peligrosos con su contenido.
  out = out.replace(DROP_WITH_CONTENT, '')
  // 2. Eliminar comentarios.
  out = out.replace(/<!--[\s\S]*?-->/g, '')

  // 3. Reescribir cada tag: dejar solo los del whitelist y limpiar atributos.
  out = out.replace(/<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_m, slash: string, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return '' // tag no permitido: se quita el markup, se conserva el texto interno
    if (slash) return `</${name}>`

    // Solo <a> conserva un href saneado (+ rel/target seguros). El resto: sin atributos.
    if (name === 'a') {
      const hrefMatch = rawAttrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const rawHref = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? '') : ''
      const href = sanitizeHref(rawHref)
      if (!href) return '<a>'
      return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer nofollow">`
    }
    return `<${name}>`
  })

  return out
}
