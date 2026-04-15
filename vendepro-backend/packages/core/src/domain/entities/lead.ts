import { LeadStage, LEAD_STAGES } from '../value-objects/lead-stage'
import type { LeadStageValue } from '../value-objects/lead-stage'
import { ValidationError } from '../errors/validation-error'
import { getLeadUrgency, getLeadChecklist, getLeadChecklistScore } from '../rules/lead-rules'
import type { LeadUrgency } from '../rules/lead-rules'

export interface LeadProps {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string
  source_detail: string | null
  property_address: string | null
  neighborhood: string | null
  property_type: string | null
  operation: string
  stage: LeadStageValue
  assigned_to: string | null
  notes: string | null
  estimated_value: number | null
  budget: string | null
  timing: string | null
  personas_trabajo: string | null
  mascotas: string | null
  next_step: string | null
  next_step_date: string | null
  lost_reason: string | null
  first_contact_at: string | null
  created_at: string
  updated_at: string
  // Computed
  tags?: string[]
  assigned_name?: string
  last_activity_at?: string | null
}

export class Lead {
  private constructor(private props: LeadProps) {}

  static create(props: Omit<LeadProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Lead {
    if (!props.full_name || props.full_name.trim().length < 2) {
      throw new ValidationError('Nombre es requerido (mín. 2 caracteres)', { full_name: 'Requerido' })
    }
    if (props.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new ValidationError('Email no válido', { email: 'Formato inválido' })
    }
    const validOps = ['venta', 'alquiler', 'alquiler_temporal', 'tasacion', 'otro']
    if (props.operation && !validOps.includes(props.operation)) {
      throw new ValidationError(`Operación inválida: "${props.operation}"`)
    }
    if (!LEAD_STAGES.includes(props.stage)) {
      throw new ValidationError(`Stage inválido: "${props.stage}"`)
    }
    const now = new Date().toISOString()
    return new Lead({
      ...props,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get full_name() { return this.props.full_name }
  get phone() { return this.props.phone }
  get email() { return this.props.email }
  get stage() { return this.props.stage }
  get operation() { return this.props.operation }
  get assigned_to() { return this.props.assigned_to }
  get notes() { return this.props.notes }
  get next_step() { return this.props.next_step }
  get next_step_date() { return this.props.next_step_date }
  get lost_reason() { return this.props.lost_reason }
  get first_contact_at() { return this.props.first_contact_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }
  get source() { return this.props.source }
  get source_detail() { return this.props.source_detail }
  get property_address() { return this.props.property_address }
  get neighborhood() { return this.props.neighborhood }
  get property_type() { return this.props.property_type }
  get estimated_value() { return this.props.estimated_value }
  get budget() { return this.props.budget }
  get timing() { return this.props.timing }
  get personas_trabajo() { return this.props.personas_trabajo }
  get mascotas() { return this.props.mascotas }
  get tags() { return this.props.tags }
  get assigned_name() { return this.props.assigned_name }
  get last_activity_at() { return this.props.last_activity_at }

  // ── Domain Methods ──────────────────────────────────
  advanceStage(newStage: LeadStageValue, notes?: string): { firstContactAt: string | null } {
    const current = LeadStage.create(this.props.stage)
    current.transitionTo(newStage) // throws if invalid

    const oldStage = this.props.stage
    let firstContactAt: string | null = null

    if (oldStage === 'nuevo' && newStage === 'contactado') {
      firstContactAt = new Date().toISOString()
      this.props.first_contact_at = firstContactAt
    }

    this.props.stage = newStage
    this.props.updated_at = new Date().toISOString()

    return { firstContactAt }
  }

  update(data: Partial<Omit<LeadProps, 'id' | 'org_id' | 'created_at'>>): void {
    if (data.full_name !== undefined && data.full_name.trim().length < 2) {
      throw new ValidationError('Nombre es requerido (mín. 2 caracteres)')
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new ValidationError('Email no válido')
    }
    Object.assign(this.props, data)
    this.props.updated_at = new Date().toISOString()
  }

  getUrgency(): LeadUrgency {
    return getLeadUrgency({
      stage: this.props.stage,
      created_at: this.props.created_at,
      updated_at: this.props.updated_at,
    })
  }

  getChecklistScore(): number {
    return getLeadChecklistScore(this.props)
  }

  getChecklist() {
    return getLeadChecklist(this.props)
  }

  needsFollowupEvent(): boolean {
    return this.props.stage === 'presentada'
  }

  toObject(): LeadProps {
    return { ...this.props }
  }
}
