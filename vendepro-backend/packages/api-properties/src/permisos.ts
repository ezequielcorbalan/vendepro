import { D1PropertyRepository, D1AppraisalRepository } from '@vendepro/infrastructure'
import { alcanceDe, puedeVerRegistro } from '@vendepro/core'

/**
 * Permisos por rol de api-properties (reglas en core/domain/rules/data-access).
 *
 * - **Propiedades**: el inventario se VE entero — un agente tiene que poder
 *   ofrecerle a su comprador una propiedad que captó otro (el buscador de
 *   "propiedades de interés" del lead ya buscaba en toda la org). Lo que se
 *   restringe es MODIFICAR: sólo el agente de la propiedad, o quien ve todo.
 * - **Tasaciones**: estrictas. Tienen los datos del propietario y el precio
 *   sugerido; el agente ve y toca sólo las suyas.
 *
 * Un registro ajeno responde 404, no 403: no confirma que el id existe.
 */

export const actor = (c: any) => ({ role: c.get('userRole') as string, userId: c.get('userId') as string })

/** Admin, owner o supervisor. */
export const veTodo = (c: any) => alcanceDe(actor(c)) === undefined

export const NO_ENCONTRADA = { error: 'Not found' }

/** La propiedad, si quien pregunta la puede modificar. */
export async function propiedadEditable(c: any, id: string | null | undefined) {
  if (!id) return null
  const propiedad = await new D1PropertyRepository(c.env.DB).findById(id, c.get('orgId')).catch(() => null)
  if (!propiedad || !puedeVerRegistro(actor(c), propiedad.agent_id)) return null
  return propiedad
}

/** La tasación, si quien pregunta la puede ver (y por lo tanto tocar). */
export async function tasacionVisible(c: any, id: string | null | undefined) {
  if (!id) return null
  const tasacion = await new D1AppraisalRepository(c.env.DB).findById(id, c.get('orgId')).catch(() => null)
  if (!tasacion || !puedeVerRegistro(actor(c), tasacion.agent_id)) return null
  return tasacion
}

/** La tasación de un comparable: de esta org y visible para quien pregunta. */
export async function tasacionDeComparable(c: any, comparableId: string | null | undefined) {
  if (!comparableId) return null
  const appraisalId = await new D1AppraisalRepository(c.env.DB)
    .findComparableAppraisalId(comparableId, c.get('orgId'))
    .catch(() => null)
  return tasacionVisible(c, appraisalId)
}
