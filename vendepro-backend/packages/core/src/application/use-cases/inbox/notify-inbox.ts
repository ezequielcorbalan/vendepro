import type { NotificationRepository } from '../../ports/repositories/notification-repository'
import type { UserRepository } from '../../ports/repositories/user-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Notification } from '../../../domain/entities/notification'

/**
 * Avisos de la bandeja por la campana.
 *
 * Usa el kind `system` y no uno propio: la tabla tiene un CHECK sobre `kind` y
 * agregar un valor obliga a reconstruirla en SQLite. El texto ya dice de qué
 * se trata.
 *
 * Nada de esto puede tirar abajo la ingesta: si avisar falla, el mensaje ya
 * está guardado y la bandeja lo muestra igual.
 */

export interface NuevoMensajeInput {
  orgId: string
  conversationId: string
  assigneeId: string | null
  /** Nombre del contacto o su teléfono, lo que haya. */
  quien: string
  texto: string | null
  /** Para el aviso sin texto: "mandó un audio". */
  tipoAdjunto?: string | null
}

export interface SesionCaidaInput {
  orgId: string
  estado: string
}

/**
 * Estados de WAHA en los que ya no entra nada. STARTING/SCAN_QR_CODE no
 * cuentan: son pasos normales de conectar, y avisar ahí sería alarma falsa
 * cada vez que alguien reconecta.
 */
export const ESTADOS_CAIDOS = ['FAILED', 'STOPPED']

const LARGO_VISTA_PREVIA = 120

const ADJUNTO_LEGIBLE: Record<string, string> = {
  image: 'una foto', audio: 'un audio', video: 'un video', file: 'un archivo',
}

export class NotifyInboxUseCase {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
    private readonly ids: IdGenerator,
  ) {}

  /**
   * Le avisa al agente asignado; si la conversación está en la cola, a los
   * admins, que son quienes la reparten.
   */
  async nuevoMensaje(input: NuevoMensajeInput): Promise<number> {
    const destinatarios = input.assigneeId ? [input.assigneeId] : await this.admins(input.orgId)
    const texto = input.texto?.trim()
    const cuerpo = texto
      ? (texto.length > LARGO_VISTA_PREVIA ? `${texto.slice(0, LARGO_VISTA_PREVIA)}…` : texto)
      : `Mandó ${ADJUNTO_LEGIBLE[input.tipoAdjunto ?? ''] ?? 'un adjunto'}`
    const titulo = input.assigneeId
      ? `${input.quien} te escribió`
      : `${input.quien} escribió y nadie lo tiene asignado`
    return this.enviar(input.orgId, destinatarios, titulo, cuerpo, `/conversaciones?c=${input.conversationId}`)
  }

  /** A los admins: son los únicos que pueden volver a escanear el QR. */
  async sesionCaida(input: SesionCaidaInput): Promise<number> {
    if (!ESTADOS_CAIDOS.includes(input.estado)) return 0
    return this.enviar(
      input.orgId,
      await this.admins(input.orgId),
      'Se desconectó el WhatsApp de la bandeja',
      'Los mensajes nuevos no están entrando. Volvé a conectarlo escaneando el QR.',
      '/configuracion/conexiones/whatsapp',
    )
  }

  private async admins(orgId: string): Promise<string[]> {
    try {
      const users = await this.users.findByOrg(orgId)
      return users.filter(u => u.isAdmin() && u.active && !u.deleted_at).map(u => u.id)
    } catch {
      return []
    }
  }

  private async enviar(
    orgId: string, userIds: string[], title: string, body: string, linkUrl: string,
  ): Promise<number> {
    let enviados = 0
    for (const userId of userIds) {
      try {
        await this.notifications.save(Notification.create({
          id: this.ids.generate(),
          org_id: orgId,
          user_id: userId,
          kind: 'system',
          title,
          body,
          link_url: linkUrl,
          read: false,
        }))
        enviados++
      } catch {
        // Un aviso que falla no frena a los demás.
      }
    }
    return enviados
  }
}
