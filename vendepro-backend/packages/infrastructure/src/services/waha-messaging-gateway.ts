import type { MessagingGateway, MessagingProviderConfig, SendMessageInput, SendMessageResult } from '@vendepro/core'

/**
 * Adapter de WAHA (WhatsApp HTTP API), el proveedor con el que arranca el
 * inbox: un contenedor que habla WhatsApp Web y expone REST.
 *
 * Es el puente temporal hasta la Cloud API oficial — va contra los términos de
 * Meta y el número se puede bloquear, así que se usa con una línea dedicada.
 * Cuando el número esté dado de alta en Cloud API, se escribe el adapter de
 * Meta y esta clase se deja de instanciar: nada más del sistema se entera.
 *
 * `enforcesWindow` es false porque WhatsApp Web no conoce la ventana de 24h:
 * deja escribir cuando sea. La UI igual la muestra, para que el día de la
 * migración el hábito del agente ya sea el correcto.
 */
export class WahaMessagingGateway implements MessagingGateway {
  readonly enforcesWindow = false

  constructor(private readonly config: MessagingProviderConfig) {}

  async sendText(input: SendMessageInput): Promise<SendMessageResult> {
    if (input.channel !== 'whatsapp') {
      throw new Error(`WAHA sólo maneja WhatsApp, no "${input.channel}"`)
    }

    const res = await fetch(`${trimSlash(this.config.baseUrl)}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'X-Api-Key': this.config.apiKey } : {}),
      },
      body: JSON.stringify({
        session: this.config.session,
        chatId: input.chatId,
        text: input.text,
      }),
    })

    if (!res.ok) {
      // El cuerpo del error dice si la sesión se cayó (hay que re-escanear el
      // QR) o si el chat no existe; sin eso el agente ve "falló" y nada más.
      const detalle = await res.text().catch(() => '')
      throw new Error(`WAHA respondió ${res.status}${detalle ? `: ${detalle.slice(0, 300)}` : ''}`)
    }

    const data = (await res.json().catch(() => null)) as any
    // WAHA devuelve el id del mensaje en `id` o anidado en `_data.id._serialized`
    // según el engine. Si no viene, se guarda sin él: el único costo es que el
    // eco entrante de ese mensaje no se puede reconocer como propio.
    const externalId = data?.id?._serialized ?? data?._data?.id?._serialized ?? data?.id ?? null
    return { externalId: typeof externalId === 'string' ? externalId : null }
  }
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}
