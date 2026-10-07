import type { MessagingGateway, SendMessageInput, SendMessageResult } from '@vendepro/core'

/** Tope de Meta para un mensaje de texto de Instagram. */
const MAX_TEXTO = 1000

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
    if (input.text.length > MAX_TEXTO) {
      throw new Error(`El mensaje supera los ${MAX_TEXTO} caracteres que acepta Meta`)
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

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
