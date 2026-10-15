import { canSeeAll } from './role-rules'

/**
 * Quién puede tocar qué en la bandeja.
 *
 * Mismo criterio que los leads: admin, owner y supervisor ven todo; el agente,
 * sólo lo que le delegaron. La cola (sin asignar) es de quien reparte — un
 * agente no la ve, porque el lead entrante es del dueño y se delega a mano.
 *
 * Vive acá y no en la pantalla: sin el chequeo en el servidor, un agente
 * podía leer cualquier conversación de la inmobiliaria pidiéndola por id.
 */

export interface Actor {
  role: string
  userId: string
}

export function puedeVerConversacion(actor: Actor, assigneeId: string | null): boolean {
  return canSeeAll(actor.role) || (assigneeId !== null && assigneeId === actor.userId)
}

/**
 * Delegar es repartir: lo hace quien ve todo. El agente sólo puede devolver
 * a la cola lo suyo ("esto no es para mí").
 */
export function puedeAsignarConversacion(actor: Actor, assigneeActual: string | null, nuevoAssignee: string | null): boolean {
  if (canSeeAll(actor.role)) return true
  return assigneeActual === actor.userId && nuevoAssignee === null
}

/** Filtro de la bandeja: `undefined` = todas; si no, sólo las de ese agente. */
export function bandejaDe(actor: Actor): string | undefined {
  return canSeeAll(actor.role) ? undefined : actor.userId
}
