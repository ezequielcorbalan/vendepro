import { ValidationError } from '../errors/validation-error'

export type BuyIntention = 'compraria' | 'tal_vez' | 'no'

export type VisitSource =
  | 'argenprop'
  | 'mercadolibre'
  | 'zonaprop'
  | 'instagram'
  | 'recomendacion'
  | 'otro'

export type VisitSituation =
  | 'mudanza'
  | 'primera_vivienda'
  | 'inversion'
  | 'downsizing'
  | 'otro'

export const VISIT_SOURCE_VALUES: VisitSource[] = [
  'argenprop',
  'mercadolibre',
  'zonaprop',
  'instagram',
  'recomendacion',
  'otro',
]

export const VISIT_SITUATION_VALUES: VisitSituation[] = [
  'mudanza',
  'primera_vivienda',
  'inversion',
  'downsizing',
  'otro',
]

export interface PropertyVisitFormProps {
  id: string
  org_id: string
  property_id: string
  agent_id: string
  slug: string
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  rating: number | null
  liked: string | null
  disliked: string | null
  subjective_price_usd: number | null
  buy_intention: BuyIntention | null
  source: VisitSource | null
  situation: VisitSituation | null
  observations: string | null
  submitted_at: string | null
  archived_at: string | null
  deleted_at: string | null
  sent_at: string
  created_at: string
}

/**
 * Ficha de Visita: cuestionario que llena el comprador/visitante luego de
 * visitar una propiedad. Se crea "pending" (sin respuestas) al generar el
 * link público; cuando el visitante lo envía, se llenan los campos de
 * visitante y respuestas y se setea submitted_at.
 */
export class PropertyVisitForm {
  private constructor(private props: PropertyVisitFormProps) {}

  static create(
    props: Omit<
      PropertyVisitFormProps,
      'created_at' | 'sent_at' | 'submitted_at' | 'archived_at' | 'deleted_at'
    > & {
      created_at?: string
      sent_at?: string
      submitted_at?: string | null
      archived_at?: string | null
      deleted_at?: string | null
    },
  ): PropertyVisitForm {
    if (!props.slug || props.slug.trim().length === 0) {
      throw new ValidationError('slug es requerido', { slug: 'Requerido' })
    }
    if (!/^[a-z0-9-]+$/i.test(props.slug)) {
      throw new ValidationError('slug inválido (solo letras, dígitos y guiones)', {
        slug: 'Formato inválido',
      })
    }
    if (!props.property_id) {
      throw new ValidationError('property_id es requerido', { property_id: 'Requerido' })
    }
    if (!props.org_id) {
      throw new ValidationError('org_id es requerido', { org_id: 'Requerido' })
    }
    const now = new Date().toISOString()
    return new PropertyVisitForm({
      ...props,
      submitted_at: props.submitted_at ?? null,
      archived_at: props.archived_at ?? null,
      deleted_at: props.deleted_at ?? null,
      sent_at: props.sent_at ?? now,
      created_at: props.created_at ?? now,
    })
  }

  archive(): void {
    if (this.props.deleted_at) {
      throw new ValidationError('No se puede archivar una ficha borrada')
    }
    if (this.props.archived_at) return
    this.props = { ...this.props, archived_at: new Date().toISOString() }
  }

  unarchive(): void {
    if (!this.props.archived_at) return
    this.props = { ...this.props, archived_at: null }
  }

  softDelete(): void {
    if (this.props.deleted_at) return
    this.props = { ...this.props, deleted_at: new Date().toISOString() }
  }

  isArchived(): boolean {
    return this.props.archived_at !== null
  }

  isDeleted(): boolean {
    return this.props.deleted_at !== null
  }

  submit(input: {
    visitor_name?: string | null
    visitor_email?: string | null
    visitor_phone?: string | null
    rating?: number | null
    liked?: string | null
    disliked?: string | null
    subjective_price_usd?: number | null
    buy_intention?: BuyIntention | null
    source?: VisitSource | null
    situation?: VisitSituation | null
    observations?: string | null
  }): void {
    if (input.buy_intention && !['compraria', 'tal_vez', 'no'].includes(input.buy_intention)) {
      throw new ValidationError('buy_intention inválido', {
        buy_intention: 'Debe ser compraria | tal_vez | no',
      })
    }
    if (input.rating != null) {
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new ValidationError('rating inválido', { rating: 'Debe ser un entero entre 1 y 5' })
      }
    }
    if (input.source && !VISIT_SOURCE_VALUES.includes(input.source)) {
      throw new ValidationError('source inválido', {
        source: `Debe ser uno de: ${VISIT_SOURCE_VALUES.join(' | ')}`,
      })
    }
    if (input.situation && !VISIT_SITUATION_VALUES.includes(input.situation)) {
      throw new ValidationError('situation inválido', {
        situation: `Debe ser uno de: ${VISIT_SITUATION_VALUES.join(' | ')}`,
      })
    }
    this.props = {
      ...this.props,
      visitor_name: input.visitor_name ?? this.props.visitor_name,
      visitor_email: input.visitor_email ?? this.props.visitor_email,
      visitor_phone: input.visitor_phone ?? this.props.visitor_phone,
      rating: input.rating ?? this.props.rating,
      liked: input.liked ?? this.props.liked,
      disliked: input.disliked ?? this.props.disliked,
      subjective_price_usd: input.subjective_price_usd ?? this.props.subjective_price_usd,
      buy_intention: input.buy_intention ?? this.props.buy_intention,
      source: input.source ?? this.props.source,
      situation: input.situation ?? this.props.situation,
      observations: input.observations ?? this.props.observations,
      submitted_at: new Date().toISOString(),
    }
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_id() { return this.props.property_id }
  get agent_id() { return this.props.agent_id }
  get slug() { return this.props.slug }
  get visitor_name() { return this.props.visitor_name }
  get visitor_email() { return this.props.visitor_email }
  get visitor_phone() { return this.props.visitor_phone }
  get rating() { return this.props.rating }
  get liked() { return this.props.liked }
  get disliked() { return this.props.disliked }
  get subjective_price_usd() { return this.props.subjective_price_usd }
  get buy_intention() { return this.props.buy_intention }
  get source() { return this.props.source }
  get situation() { return this.props.situation }
  get observations() { return this.props.observations }
  get submitted_at() { return this.props.submitted_at }
  get archived_at() { return this.props.archived_at }
  get deleted_at() { return this.props.deleted_at }
  get sent_at() { return this.props.sent_at }
  get created_at() { return this.props.created_at }

  isSubmitted(): boolean {
    return this.props.submitted_at !== null
  }

  toObject(): PropertyVisitFormProps {
    return { ...this.props }
  }
}
