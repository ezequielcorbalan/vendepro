import type {
  ListingPageFetcher,
  ListingPageFetchResult,
} from '@vendepro/core'

/**
 * Trae la página de un aviso por HTTP y la reduce a texto plano.
 *
 * Advertencia deliberada, escrita acá para que no se pierda: los portales
 * argentinos corren anti-bot (Zonaprop usa DataDome) y las IPs de salida de
 * Cloudflare Workers son datacenter, así que un porcentaje de los links va a
 * volver `blocked`. Eso NO es un bug a arreglar con más headers: es el motivo
 * por el que el flujo por captura de pantalla sigue existiendo y por el que
 * `ListingPageFetchStatus` distingue `blocked` del resto — la UI tiene que
 * poder decir "subí una captura" en lugar de "falló".
 */

/** UA de navegador real. Sin esto varios portales devuelven 403 de entrada. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TIMEOUT_MS = 15_000

/** Techo de HTML a bajar. Un aviso entero entra de sobra; el resto es ruido. */
const MAX_HTML_CHARS = 600_000

/** Techo de texto ya limpio que le mandamos al modelo. */
const MAX_TEXT_CHARS = 24_000

/** Marcas de un muro anti-bot devuelto con status 200. */
const CHALLENGE_MARKERS = [
  'datadome',
  'captcha-delivery',
  'cf-browser-verification',
  'just a moment',
  'enable javascript and cookies to continue',
  'px-captcha',
  'perimeterx',
  'access denied',
]

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', deg: '°', euro: '€',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m)
}

/**
 * HTML → texto plano.
 *
 * Se queda con el JSON-LD (`application/ld+json`) además del texto visible: los
 * portales publican ahí precio y superficie estructurados, y cuando el HTML
 * visible viene armado por JavaScript ese bloque suele ser lo único aprovechable.
 */
export function htmlToText(html: string): string {
  const ldJson: string[] = []
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = ldRe.exec(html)) !== null) {
    const chunk = m[1].trim()
    if (chunk) ldJson.push(chunk)
  }

  const stripped = html
    .replace(/<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const text = decodeEntities(stripped)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')

  const combined = ldJson.length > 0 ? `${text}\n\n[datos estructurados]\n${ldJson.join('\n')}` : text
  return combined.slice(0, MAX_TEXT_CHARS)
}

export class HttpListingPageFetcher implements ListingPageFetcher {
  async fetchText(url: string): Promise<ListingPageFetchResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        },
      })

      if (res.status === 404 || res.status === 410) {
        return { status: 'not_found', text: '', httpStatus: res.status }
      }
      if (res.status === 403 || res.status === 429 || res.status === 401) {
        console.error(`[listing-fetch] ${res.status} en ${url}`)
        return { status: 'blocked', text: '', httpStatus: res.status }
      }
      if (!res.ok) {
        console.error(`[listing-fetch] ${res.status} en ${url}`)
        return { status: 'unreachable', text: '', httpStatus: res.status }
      }

      const html = (await res.text()).slice(0, MAX_HTML_CHARS)
      const head = html.slice(0, 4000).toLowerCase()
      if (CHALLENGE_MARKERS.some((marker) => head.includes(marker))) {
        console.error(`[listing-fetch] challenge anti-bot con 200 en ${url}`)
        return { status: 'blocked', text: '', httpStatus: res.status }
      }

      return { status: 'ok', text: htmlToText(html), httpStatus: res.status }
    } catch (e) {
      console.error(`[listing-fetch] sin respuesta de ${url}:`, e)
      return { status: 'unreachable', text: '', httpStatus: null }
    } finally {
      clearTimeout(timeout)
    }
  }
}
