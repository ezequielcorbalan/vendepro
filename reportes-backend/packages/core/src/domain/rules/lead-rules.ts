import type { LeadStageValue } from '../value-objects/lead-stage'

export type LeadUrgency = 'ok' | 'warning' | 'danger' | 'lost'

export interface LeadForUrgency {
  stage: LeadStageValue
  created_at: string
  updated_at: string
}

/**
 * Lead must be contacted within 24h of creation.
 * No updates for 7 days = danger.
 * No updates for 3 days = warning.
 */
export function getLeadUrgency(lead: LeadForUrgency): LeadUrgency {
  if (lead.stage === 'perdido') return 'lost'
  if (lead.stage === 'captado') return 'ok'

  const now = new Date()
  const updated = lead.updated_at ? new Date(lead.updated_at) : new Date(lead.created_at)
  const diffH = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)

  if (lead.stage === 'nuevo') {
    const createdAt = new Date(lead.created_at)
    const createdHoursAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    if (createdHoursAgo > 24) return 'danger'
  }

  if (diffH > 168) return 'danger'  // 7 days
  if (diffH > 72) return 'warning'  // 3 days
  return 'ok'
}

export interface LeadForChecklist {
  phone: string | null
  email: string | null
  notes: string | null
  operation: string | null
  estimated_value: number | null
  budget: string | null
  neighborhood: string | null
  property_address: string | null
  next_step: string | null
}

export function getLeadChecklist(lead: LeadForChecklist) {
  return {
    contacto:       !!(lead.phone || lead.email),
    necesidad:      !!(lead.notes && lead.notes.length > 5),
    operacion:      !!(lead.operation && lead.operation !== ''),
    presupuesto:    !!(lead.estimated_value || lead.budget),
    zona:           !!(lead.neighborhood || lead.property_address),
    proxima_accion: !!(lead.next_step),
  }
}

export function getLeadChecklistScore(lead: LeadForChecklist): number {
  const cl = getLeadChecklist(lead)
  const total = Object.values(cl).filter(Boolean).length
  return Math.round((total / 6) * 100)
}

export function isOverdue(lead: LeadForUrgency): boolean {
  return getLeadUrgency(lead) === 'danger'
}
