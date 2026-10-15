import type { ConversationChannel } from '@vendepro/core'

/**
 * Verificación de los webhooks de Meta.
 *
 * Meta no permite mandar headers propios en sus webhooks, así que el endpoint
 * no puede pedir nuestro token de integración como el de WhatsApp: tiene que
 * ser público y validarse por firma. Meta firma el cuerpo con el app secret y
 * manda el resultado en `X-Hub-Signature-256`.
 */
export async function verificarFirmaMeta(
  rawBody: string,
  firmaHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!firmaHeader || !appSecret) return false
  const esperado = firmaHeader.startsWith('sha256=') ? firmaHeader.slice(7) : firmaHeader

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const calculado = Array.from(new Uint8Array(firma)).map(b => b.toString(16).padStart(2, '0')).join('')

  return comparacionConstante(calculado, esperado.toLowerCase())
}

/** Comparar con `===` filtra el secreto por el tiempo que tarda en fallar. */
function comparacionConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

export interface MensajeMeta {
  /** Id de la página / cuenta de Instagram que recibió el mensaje. */
  cuentaId: string
  channel: ConversationChannel
  /** IGSID o PSID de la persona: es el chat de la conversación. */
  remitenteId: string
  mensajeId: string | null
  texto: string | null
  adjuntos: Array<{ type: string; url?: string | null }>
  enviadoEn: string
}

/**
 * Aplana el webhook de Meta a mensajes nuestros.
 *
 * Descarta los **echoes**: cuando la página manda un mensaje, Meta se lo
 * devuelve marcado `is_echo`. Si se ingresaran, cada respuesta del agente
 * aparecería dos veces en el hilo y el bot creería que el cliente escribió.
 *
 * Un evento que no es un mensaje (lecturas, reacciones, entregas) se ignora
 * en silencio: Meta manda muchos tipos por el mismo webhook.
 */
export function parsearWebhookMeta(payload: any): MensajeMeta[] {
  const objeto = payload?.object
  const channel: ConversationChannel = objeto === 'instagram' ? 'instagram' : 'facebook'
  const entradas = Array.isArray(payload?.entry) ? payload.entry : []
  const mensajes: MensajeMeta[] = []

  for (const entrada of entradas) {
    const cuentaId = String(entrada?.id ?? '')
    const eventos = Array.isArray(entrada?.messaging) ? entrada.messaging : []
    for (const evento of eventos) {
      const mensaje = evento?.message
      if (!mensaje || mensaje.is_echo) continue

      const adjuntos = Array.isArray(mensaje.attachments)
        ? mensaje.attachments.map((a: any) => ({ type: String(a?.type ?? 'archivo'), url: a?.payload?.url ?? null }))
        : []
      const texto = typeof mensaje.text === 'string' ? mensaje.text : null
      if (!texto && adjuntos.length === 0) continue

      mensajes.push({
        cuentaId,
        channel,
        remitenteId: String(evento?.sender?.id ?? ''),
        mensajeId: mensaje.mid ? String(mensaje.mid) : null,
        texto,
        adjuntos,
        enviadoEn: evento?.timestamp
          ? new Date(Number(evento.timestamp)).toISOString()
          : new Date().toISOString(),
      })
    }
  }

  return mensajes.filter(m => m.cuentaId && m.remitenteId)
}
