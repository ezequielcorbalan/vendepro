// ============================================================
// Agent scope helper — restricts data visibility by role
// ============================================================
// Agents only see their own data (leads, properties, contacts, appraisals).
// Admins and supervisors see everything.
// An admin/supervisor can assign items to agents — that's the only way
// an agent gets visibility on someone else's data.
//
// Esto es comodidad de pantalla: la regla la exige el servidor (api-crm,
// core/domain/rules/data-access). Sacar el filtro de acá no muestra más.

import { getCurrentUser } from './auth'
import { canSeeAll } from './crm-config'

/**
 * Returns the agent_id to use for filtering API calls.
 * - If the user is an agent → returns their user ID (restrict to own data)
 * - If admin/supervisor → returns undefined (see everything)
 */
export function getScopedAgentId(): string | undefined {
  const user = getCurrentUser()
  if (!user) return undefined
  // El owner ve todo: antes caía como agente y sólo veía lo suyo.
  if (canSeeAll(user.role)) return undefined
  return user.id
}

/**
 * Appends agent_id to a URLSearchParams object if the user is an agent.
 * Mutates and returns the same params for chaining.
 */
export function applyScopeToParams(params: URLSearchParams): URLSearchParams {
  const agentId = getScopedAgentId()
  if (agentId) {
    params.set('agent_id', agentId)
  }
  return params
}

/**
 * Returns a query string like "?agent_id=xxx" if the user is an agent,
 * or an empty string if admin/supervisor.
 */
export function scopeQueryString(): string {
  const agentId = getScopedAgentId()
  return agentId ? `?agent_id=${agentId}` : ''
}

/**
 * Returns true if the current user has admin/supervisor privileges
 * (can see all data, assign items, etc.)
 */
export function isAdminOrSupervisor(): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return canSeeAll(user.role)
}
