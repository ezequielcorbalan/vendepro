import type { ConversationChannel } from '../../../domain/entities/conversation'
import type { MessageAttachment } from '../../../domain/entities/message'

export interface SendMessageInput {
  channel: ConversationChannel
  /** Chat del proveedor: jid de WhatsApp, PSID de Messenger. */
  chatId: string
  text: string
}

export interface SendMessageResult {
  /** Id del mensaje en el proveedor, para poder reconocer su eco entrante. */
  externalId: string | null
}

/**
 * El canal por el que VendéPro manda un mensaje.
 *
 * Es un port y no una llamada HTTP suelta porque el proveedor va a cambiar:
 * se arranca con uno no oficial (WhatsApp Web) para no esperar el trámite con
 * Meta, y se migra a la Cloud API cuando el número esté dado de alta. Con esto
 * en el medio, migrar es escribir otro adapter y cambiar la config de la org;
 * sin esto, sería tocar cada lugar que manda un mensaje.
 *
 * Instagram y Facebook entran por acá también, cambiando `channel`.
 */
export interface MessagingGateway {
  /**
   * ¿El proveedor hace cumplir la ventana de 24h de WhatsApp?
   *
   * La Cloud API la impone (fuera de ventana sólo deja plantillas aprobadas);
   * un proveedor que habla WhatsApp Web, no. El caso de uso lo consulta para
   * negarse a mandar texto libre fuera de ventana cuando corresponde, en vez
   * de que el mensaje se pierda del lado de Meta.
   */
  readonly enforcesWindow: boolean

  sendText(input: SendMessageInput): Promise<SendMessageResult>
}

/** Config que necesita un adapter para hablar con su proveedor. */
export interface MessagingProviderConfig {
  baseUrl: string
  /** Sesión/instancia del proveedor (WAHA y Evolution manejan varias). */
  session: string
  apiKey: string | null
}

export type { MessageAttachment }
