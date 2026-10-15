import type { MessagingGateway, SendMessageInput, SendMessageResult } from '@vendepro/core'

/** Topes de Meta para un mensaje de texto: Instagram corta antes que Messenger. */
const MAX_TEXTO: Record<string, number> = { instagram: 1000, facebook: 2000 }

export interface MetaMessagingConfig {
  /** Page access token de la página vinculada a la cuenta de Instagram. */
  pageAccessToken: string
  /** Versión de la Graph API. Se deja configurable: Meta las deprecia cada ~2 años. */
  apiVersion?: string
  /** Sólo para tests: apuntar a un servidor propio en vez de graph.facebook.com. */
  baseUrl?: string
}

/**
 * Adapter oficial de Meta (Messenger Platform) para Instagram y Facebook.
 *
 * A diferencia de WhatsApp, acá no hay trámite de número ni portabilidad: las
 * páginas ya son de la inmobiliaria y alcanza con autorizar la app. Por eso
 * este canal puede estar en producción antes que WhatsApp, y encima por la vía
 * oficial.
 *
 * `enforcesWindow` es true: fuera de las 24h desde el último mensaje de la
 * persona, Meta rechaza el texto libre. Mejor negarse acá y decírselo al
 * agente que mandar algo que se pierde del lado de Meta sin aviso.
 */
export class MetaMessagingGateway implements MessagingGateway {
  readonly enforcesWindow = true

  constructor(private readonly config: MetaMessagingConfig) {}

  async sendText(input: SendMessageInput): Promise<SendMessageResult> {
    if (input.channel === 'whatsapp') {
      throw new Error('Este adapter es para Instagram y Facebook; WhatsApp va por su propio canal')
    }
    const tope = MAX_TEXTO[input.channel] ?? 1000
    if (input.text.length > tope) {
      throw new Error(`El mensaje supera los ${tope} caracteres que acepta Meta`)
    }

    const base = this.config.baseUrl ?? 'https://graph.facebook.com'
    const version = this.config.apiVersion ?? 'v21.0'
    const url = `${trimSlash(base)}/${version}/me/messages?access_token=${encodeURIComponent(this.config.pageAccessToken)}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.chatId },
        message: { text: input.text },
      }),
    })

    const data = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      // El error de Meta trae el motivo real (token vencido, fuera de ventana,
      // permiso faltante). Sin eso el agente ve "falló" y nadie sabe qué pasó.
      const motivo = data?.error?.message ?? (await Promise.resolve('')).toString()
      throw new Error(`Meta respondió ${res.status}${motivo ? `: ${motivo}` : ''}`)
    }

    return { externalId: typeof data?.message_id === 'string' ? data.message_id : null }
  }
}

export interface PerfilMeta {
  nombre: string | null
  /** @usuario de Instagram (Messenger no lo expone). */
  usuario: string | null
}

/**
 * Nombre de quien escribe, que el webhook de Meta no trae: sin esto el
 * contacto quedaba como "facebook 856672" y el agente no sabía con quién
 * hablaba. Best-effort: si Meta no responde a tiempo, se sigue sin nombre.
 */
export async function obtenerPerfilMeta(
  config: MetaMessagingConfig,
  userId: string,
  channel: 'instagram' | 'facebook',
): Promise<PerfilMeta> {
  const base = config.baseUrl ?? 'https://graph.facebook.com'
  const version = config.apiVersion ?? 'v21.0'
  const campos = channel === 'instagram' ? 'name,username' : 'first_name,last_name'
  const url = `${trimSlash(base)}/${version}/${encodeURIComponent(userId)}?fields=${campos}&access_token=${encodeURIComponent(config.pageAccessToken)}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return { nombre: null, usuario: null }
    const d = (await res.json().catch(() => null)) as any
    const nombre = channel === 'instagram'
      ? (d?.name ?? null)
      : [d?.first_name, d?.last_name].filter(Boolean).join(' ') || null
    return { nombre: nombre ? String(nombre).trim() : null, usuario: d?.username ? String(d.username) : null }
  } catch {
    return { nombre: null, usuario: null }
  }
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
