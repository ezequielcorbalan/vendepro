import { ValidationError } from '../errors/validation-error'

export type EmailAutomationStatus = 'draft' | 'active' | 'paused'

export interface AutomationStep {
  /** Espera desde el paso anterior (o desde la inscripción, para el paso 0). */
  delay_hours: number
  subject: string
  preheader: string
  html: string
  text: string
}

export interface EmailAutomationProps {
  id: string
  org_id: string
  name: string
  status: EmailAutomationStatus
  /** 'lead_created' | 'stage:<stage>' | 'appraisal_created' | null (solo manual). */
  trigger_event: string | null
  trigger_filter_json: string | null
  steps_json: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export class EmailAutomation {
  private constructor(private props: EmailAutomationProps) {}

  static create(
    input: Pick<EmailAutomationProps, 'id' | 'org_id' | 'name'> &
      Partial<Omit<EmailAutomationProps, 'id' | 'org_id' | 'name' | 'status'>>,
  ): EmailAutomation {
    if (!input.org_id?.trim()) throw new ValidationError('org_id es requerido')
    if (!input.name?.trim()) throw new ValidationError('El nombre de la automatización es requerido')
    const now = new Date().toISOString()
    return new EmailAutomation({
      id: input.id,
      org_id: input.org_id,
      name: input.name.trim(),
      status: 'draft',
      trigger_event: input.trigger_event ?? null,
      trigger_filter_json: input.trigger_filter_json ?? null,
      steps_json: input.steps_json ?? null,
      created_by: input.created_by ?? null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: EmailAutomationProps): EmailAutomation {
    return new EmailAutomation({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get status() { return this.props.status }
  get trigger_event() { return this.props.trigger_event }
  get trigger_filter_json() { return this.props.trigger_filter_json }
  get steps_json() { return this.props.steps_json }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  get steps(): AutomationStep[] {
    if (!this.props.steps_json) return []
    try {
      const parsed = JSON.parse(this.props.steps_json)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  get isActive(): boolean {
    return this.props.status === 'active'
  }

  /** Un paso válido tiene asunto y contenido. */
  assertActivatable(): void {
    const steps = this.steps
    if (steps.length === 0) throw new ValidationError('La automatización no tiene pasos')
    steps.forEach((s, i) => {
      if (!s.subject?.trim()) throw new ValidationError(`El paso ${i + 1} no tiene asunto`)
      if (!s.html?.trim()) throw new ValidationError(`El paso ${i + 1} no tiene contenido`)
      if (typeof s.delay_hours !== 'number' || s.delay_hours < 0) {
        throw new ValidationError(`El paso ${i + 1} tiene una demora inválida`)
      }
    })
  }

  update(patch: Partial<Omit<EmailAutomationProps, 'id' | 'org_id' | 'created_at'>>): void {
    if (patch.name !== undefined && !patch.name?.trim()) {
      throw new ValidationError('El nombre de la automatización es requerido')
    }
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): EmailAutomationProps {
    return { ...this.props }
  }
}
