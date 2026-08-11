import type { AssignedAgent } from '@vendepro/core'
import { D1UserRepository } from '../repositories/d1-user-repository'

/**
 * Resuelve `{ name, email }` del agente asignado a partir de su user_id,
 * para el objeto `assigned_agent` del webhook `lead.created`.
 * Devuelve `null` si no hay agente asignado o si no se encuentra el usuario.
 * Best-effort: cualquier error de lectura degrada a `null` (no rompe el envío).
 */
export async function resolveAssignedAgent(
  db: D1Database,
  orgId: string,
  userId: string | null | undefined,
): Promise<AssignedAgent | null> {
  if (!userId) return null
  try {
    const user = await new D1UserRepository(db).findById(userId, orgId)
    if (!user) return null
    return { name: user.name ?? null, email: user.email ?? null }
  } catch {
    return null
  }
}
