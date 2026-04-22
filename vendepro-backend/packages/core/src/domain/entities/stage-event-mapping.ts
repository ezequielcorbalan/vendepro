import { ValidationError } from '../errors/validation-error'

export const META_STANDARD_EVENTS = ['Lead', 'Schedule', 'Contact', 'Purchase', 'CompleteRegistration', 'SubmitApplication'] as const
export type MetaStandardEvent = typeof META_STANDARD_EVENTS[number]

export interface StageEventMappingProps {
  id: string
  org_id: string
  stage_key: string
  meta_event_name: string
  enabled: boolean
  created_at: string
}

export class StageEventMapping {
  private constructor(private props: StageEventMappingProps) {}

  static create(
    input: Omit<StageEventMappingProps, 'created_at' | 'enabled'> & { enabled?: boolean; created_at?: string },
  ): StageEventMapping {
    if (!input.id || !input.org_id) throw new ValidationError('id y org_id son requeridos')
    if (!input.stage_key || input.stage_key.trim().length === 0) {
      throw new ValidationError('stage_key es requerido')
    }
    if (!input.meta_event_name || input.meta_event_name.trim().length === 0) {
      throw new ValidationError('meta_event_name es requerido')
    }
    return new StageEventMapping({
      id: input.id,
      org_id: input.org_id,
      stage_key: input.stage_key,
      meta_event_name: input.meta_event_name,
      enabled: input.enabled ?? true,
      created_at: input.created_at ?? new Date().toISOString(),
    })
  }

  static fromPersistence(props: StageEventMappingProps): StageEventMapping {
    return new StageEventMapping({ ...props })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get stage_key() { return this.props.stage_key }
  get meta_event_name() { return this.props.meta_event_name }
  get enabled() { return this.props.enabled }
  get created_at() { return this.props.created_at }

  update(patch: Partial<Pick<StageEventMappingProps, 'meta_event_name' | 'enabled'>>): void {
    if (patch.meta_event_name !== undefined) this.props.meta_event_name = patch.meta_event_name
    if (patch.enabled !== undefined) this.props.enabled = patch.enabled
  }

  toObject(): StageEventMappingProps {
    return { ...this.props }
  }
}
