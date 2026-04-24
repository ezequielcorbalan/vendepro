import { ValidationError } from '../errors/validation-error'

export const META_STANDARD_EVENTS = ['Lead', 'Schedule', 'Contact', 'Purchase', 'CompleteRegistration', 'SubmitApplication'] as const
export type MetaStandardEvent = typeof META_STANDARD_EVENTS[number]

// GA4: los nombres recomendados son snake_case. No hay lista cerrada (eventos custom permitidos),
// pero estos son los que Stape/GA4 reconocen por defecto para real-estate.
export const GA4_RECOMMENDED_EVENTS = [
  'generate_lead', 'sign_up', 'qualify_lead', 'working_lead',
  'schedule', 'view_item', 'select_item', 'form_submit', 'purchase',
] as const
export type Ga4RecommendedEvent = typeof GA4_RECOMMENDED_EVENTS[number]

export interface StageEventMappingProps {
  id: string
  org_id: string
  /** Clave lógica del evento del CRM — stages, `lead_created`, `appraisal_created`, etc. */
  stage_key: string
  meta_event_name: string
  /** Nombre del evento en GA4 (opcional). Si null/'' → no se envía a GA4. */
  ga4_event_name: string | null
  enabled: boolean
  created_at: string
}

export class StageEventMapping {
  private constructor(private props: StageEventMappingProps) {}

  static create(
    input: Omit<StageEventMappingProps, 'created_at' | 'enabled' | 'ga4_event_name'> & {
      enabled?: boolean
      ga4_event_name?: string | null
      created_at?: string
    },
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
      ga4_event_name: input.ga4_event_name ?? null,
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
  get ga4_event_name() { return this.props.ga4_event_name }
  get enabled() { return this.props.enabled }
  get created_at() { return this.props.created_at }

  update(patch: Partial<Pick<StageEventMappingProps, 'meta_event_name' | 'ga4_event_name' | 'enabled'>>): void {
    if (patch.meta_event_name !== undefined) this.props.meta_event_name = patch.meta_event_name
    if (patch.ga4_event_name !== undefined) this.props.ga4_event_name = patch.ga4_event_name
    if (patch.enabled !== undefined) this.props.enabled = patch.enabled
  }

  toObject(): StageEventMappingProps {
    return { ...this.props }
  }
}
