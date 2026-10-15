/**
 * Un aviso en vivo a las pantallas abiertas. No lleva datos: dice QUÉ cambió
 * y la pantalla lo vuelve a pedir por la API, que aplica los permisos.
 */
export type EventoTiempoReal =
  /** Algo cambió en una conversación: mensaje nuevo, delegación, estado, etiquetas. */
  | {
      tipo: 'conversacion'
      conversationId: string
      assigneeId: string | null
      /** Si se delegó: el dueño anterior también se entera (la pierde de su bandeja). */
      previoAssigneeId?: string | null
    }
  /** Hay una notificación nueva en la campana de estos usuarios. */
  | { tipo: 'aviso'; userIds: string[] }

/**
 * ¿Le llega este aviso a esta conexión?
 *
 * Mismo criterio que la bandeja (conversation-access): quien ve todo recibe
 * todo; un agente, sólo lo de sus conversaciones — incluida la que le
 * acaban de sacar, para que desaparezca de su lista en el momento.
 */
export interface Suscriptor {
  userId: string
  veTodo: boolean
}

export function debeRecibir(suscriptor: Suscriptor, evento: EventoTiempoReal): boolean {
  if (evento.tipo === 'aviso') return evento.userIds.includes(suscriptor.userId)
  if (suscriptor.veTodo) return true
  return evento.assigneeId === suscriptor.userId || evento.previoAssigneeId === suscriptor.userId
}
