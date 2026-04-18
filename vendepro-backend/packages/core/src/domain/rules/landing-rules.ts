import type { LandingStatusValue } from '../value-objects/landing-status'

export type Role = 'admin' | 'agent'

export interface Actor {
  role: Role
  userId: string
}

export interface LandingRef {
  agent_id: string
  status?: LandingStatusValue
}

export function isOwner(actor: Actor, ref: LandingRef): boolean {
  return actor.userId === ref.agent_id
}

export function canEditLanding(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (ref.status === 'published' || ref.status === 'archived') return false
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canRequestPublish(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (ref.status !== 'draft') return false
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canPublish(actor: Actor): boolean {
  return actor.role === 'admin'
}

export function canRejectPublishRequest(actor: Actor): boolean {
  return actor.role === 'admin'
}

export function canArchive(actor: Actor, ref: LandingRef): boolean {
  if (actor.role === 'admin') return true
  return isOwner(actor, ref)
}

export function canRollback(actor: Actor, ref: LandingRef & { status: LandingStatusValue }): boolean {
  if (actor.role === 'admin') return true
  if (!isOwner(actor, ref)) return false
  return ref.status === 'draft' || ref.status === 'pending_review'
}

export function canManageTemplates(actor: Actor): boolean {
  return actor.role === 'admin'
}

// Retention policy: keep latest N non-publish versions per landing + todas las `publish`
export const VERSION_RETENTION_NON_PUBLISH = 20

// AI rate limit
export const AI_EDITS_PER_MINUTE = 30

// Auto-save throttle
export const AUTOSAVE_THROTTLE_MS = 30_000
