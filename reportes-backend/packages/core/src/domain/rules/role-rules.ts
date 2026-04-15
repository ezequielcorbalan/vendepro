export type UserRole = 'owner' | 'admin' | 'supervisor' | 'agent'

/** Can this role see all agents' data? */
export function canSeeAll(role: UserRole | string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

/** Can this role manage org settings, create admins, etc? */
export function canManageOrg(role: UserRole | string): boolean {
  return role === 'admin' || role === 'owner'
}

/** Can this role create/delete agents? */
export function canManageAgents(role: UserRole | string): boolean {
  return role === 'admin' || role === 'owner'
}

/** Can this role set objectives for other agents? */
export function canSetObjectives(role: UserRole | string): boolean {
  return role === 'admin' || role === 'owner' || role === 'supervisor'
}

/** Is this an admin-level role? */
export function isAdmin(role: UserRole | string): boolean {
  return role === 'admin' || role === 'owner'
}
