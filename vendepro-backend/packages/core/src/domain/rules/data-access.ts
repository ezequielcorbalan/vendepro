import { canSeeAll } from './role-rules'

/**
 * Quién ve qué en el CRM (leads, contactos, agenda, actividades).
 *
 * La regla ya estaba escrita en el frontend (`lib/agent-scope.ts`): admin,
 * owner y supervisor ven todo; el agente, sólo lo suyo, y delegar es la única
 * forma de que vea algo ajeno. Pero la aplicaba SÓLO la pantalla: el servidor
 * le devolvía cualquier lead, contacto o evento a quien lo pidiera por id o
 * sacando el `agent_id` del query.
 */

export interface Actor {
  role: string
  userId: string
}

/**
 * Filtro para listados: `undefined` = toda la org; si no, el id del agente.
 * Pisa lo que venga en el query: un agente no puede pedir la lista de otro.
 */
export function alcanceDe(actor: Actor, pedido?: string | null): string | undefined {
  if (canSeeAll(actor.role)) return pedido || undefined
  return actor.userId
}

/** ¿Puede ver / tocar un registro cuyo dueño es `duenoId`? */
export function puedeVerRegistro(actor: Actor, duenoId: string | null | undefined): boolean {
  return canSeeAll(actor.role) || (!!duenoId && duenoId === actor.userId)
}

/**
 * A quién queda asignado algo que crea el actor. Un agente crea para sí: si
 * pudiera crear a nombre de otro, sería una delegación sin aviso ni permisos.
 */
export function duenoAlCrear(actor: Actor, pedido?: string | null): string {
  if (canSeeAll(actor.role) && pedido) return pedido
  return actor.userId
}
