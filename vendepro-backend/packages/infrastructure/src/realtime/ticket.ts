/**
 * Ticket para abrir el WebSocket de tiempo real.
 *
 * Un WebSocket del navegador no puede mandar el header Authorization, así que
 * la sesión tiene que viajar en la URL. Poner ahí el JWT de la sesión lo
 * dejaría en logs de proxies y del navegador; en su lugar se pide un ticket
 * que dura un minuto y sólo sirve para conectarse.
 *
 * Firma HMAC-SHA256 con el JWT_SECRET y un prefijo propio: un ticket no sirve
 * como sesión ni una sesión como ticket.
 */

export interface DatosTicket {
  userId: string
  orgId: string
  /** Admin, owner o supervisor: recibe los avisos de toda la bandeja. */
  veTodo: boolean
}

const PROPOSITO = 'tiempo-real:'
const DURACION_MS = 60_000

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const desdeB64url = (texto: string) =>
  Uint8Array.from(atob(texto.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

async function firmar(secreto: string, contenido: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(PROPOSITO + secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(contenido))
  return b64url(new Uint8Array(firma))
}

export async function emitirTicket(secreto: string, datos: DatosTicket, ahora = Date.now()): Promise<string> {
  const contenido = b64url(new TextEncoder().encode(JSON.stringify({ ...datos, exp: ahora + DURACION_MS })))
  return `${contenido}.${await firmar(secreto, contenido)}`
}

/** `null` si está vencido, mal firmado o mal formado. */
export async function verificarTicket(secreto: string, ticket: string, ahora = Date.now()): Promise<DatosTicket | null> {
  const [contenido, firma] = ticket.split('.')
  if (!contenido || !firma) return null
  const esperada = await firmar(secreto, contenido)
  if (esperada.length !== firma.length) return null
  let diferencia = 0
  for (let i = 0; i < firma.length; i++) diferencia |= esperada.charCodeAt(i) ^ firma.charCodeAt(i)
  if (diferencia !== 0) return null
  try {
    const d = JSON.parse(new TextDecoder().decode(desdeB64url(contenido)))
    if (typeof d?.exp !== 'number' || d.exp < ahora) return null
    if (typeof d.userId !== 'string' || typeof d.orgId !== 'string') return null
    return { userId: d.userId, orgId: d.orgId, veTodo: d.veTodo === true }
  } catch {
    return null
  }
}
