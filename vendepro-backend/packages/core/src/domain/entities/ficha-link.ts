import { ValidationError } from '../errors/validation-error'

/**
 * - 'single': generado para un lead concreto. Llega pre-llenado y acepta un
 *   solo envío; después queda cerrado.
 * - 'open': link permanente del agente o de la inmobiliaria. Cada envío crea
 *   un lead nuevo. Es el que va en la bio de Instagram o en la firma del mail.
 */
export type FichaLinkMode = 'single' | 'open'

export const FICHA_LINK_MODES: FichaLinkMode[] = ['single', 'open']

/** Campos que un link 'single' deja pre-cargados en el formulario. */
export interface FichaLinkPrefill {
  address?: string | null
  neighborhood?: string | null
  property_type?: string | null
  owner_name?: string | null
  owner_phone?: string | null
  owner_email?: string | null
}

export interface FichaLinkProps {
  id: string
  org_id: string
  /** NULL = link institucional: el lead cae en el admin de la org. */
  agent_id: string | null
  mode: FichaLinkMode
  slug: string
  label: string | null
  lead_id: string | null
  prefill: FichaLinkPrefill | null
  active: boolean
  submissions_count: number
  last_submitted_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Link público de Ficha de Tasación. El propietario lo abre en /f/<slug>,
 * completa el cuestionario y el envío entra al CRM como contacto + lead +
 * ficha + tasación en borrador.
 */
export class FichaLink {
  private constructor(private props: FichaLinkProps) {}

  static create(
    props: Omit<
      FichaLinkProps,
      'active' | 'submissions_count' | 'last_submitted_at' | 'archived_at' | 'created_at' | 'updated_at'
    > & {
      active?: boolean
      submissions_count?: number
      last_submitted_at?: string | null
      archived_at?: string | null
      created_at?: string
      updated_at?: string
    },
  ): FichaLink {
    if (!props.slug?.trim()) throw new ValidationError('slug es requerido')
    if (!FICHA_LINK_MODES.includes(props.mode)) {
      throw new ValidationError(`mode inválido: ${props.mode}`)
    }
    // Un link 'open' no puede colgar de un lead: cada envío crea el suyo.
    if (props.mode === 'open' && props.lead_id) {
      throw new ValidationError('Un link abierto no puede estar atado a un lead')
    }
    const now = new Date().toISOString()
    return new FichaLink({
      ...props,
      active: props.active ?? true,
      submissions_count: props.submissions_count ?? 0,
      last_submitted_at: props.last_submitted_at ?? null,
      archived_at: props.archived_at ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get mode() { return this.props.mode }
  get slug() { return this.props.slug }
  get label() { return this.props.label }
  get lead_id() { return this.props.lead_id }
  get prefill() { return this.props.prefill }
  get submissions_count() { return this.props.submissions_count }

  /**
   * Un link 'single' se agota con el primer envío; uno 'open' nunca.
   * Archivar o desactivar cierra los dos.
   */
  acceptsSubmissions(): boolean {
    if (!this.props.active || this.props.archived_at) return false
    if (this.props.mode === 'single' && this.props.submissions_count > 0) return false
    return true
  }

  toObject(): FichaLinkProps {
    return { ...this.props, prefill: this.props.prefill ? { ...this.props.prefill } : null }
  }
}
