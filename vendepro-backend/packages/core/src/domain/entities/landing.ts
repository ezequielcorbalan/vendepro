import { LandingStatus, type LandingStatusValue } from '../value-objects/landing-status'
import { LandingSlug } from '../value-objects/landing-slug'
import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'

export type LandingKind = 'lead_capture' | 'property'

export interface LeadRules {
  assigned_agent_id?: string
  tags?: string[]
  campaign?: string
  notify_channels?: Array<'email' | 'whatsapp'>
}

export interface LandingProps {
  id: string
  org_id: string
  agent_id: string
  template_id: string
  kind: LandingKind
  slug_base: string
  slug_suffix: string
  status: LandingStatusValue
  blocks: Block[]
  brand_voice: string | null
  lead_rules: LeadRules | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_version_id: string | null
  published_at: string | null
  published_by: string | null
  last_review_note: string | null
  created_at: string
  updated_at: string
}

export type LandingCreateInput =
  Omit<LandingProps, 'status' | 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'published_version_id' | 'published_at' | 'published_by' | 'last_review_note' | 'created_at' | 'updated_at'>
  & Partial<Pick<LandingProps, 'status' | 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'created_at' | 'updated_at'>>

const VALID_KINDS: LandingKind[] = ['lead_capture', 'property']

export class Landing {
  private constructor(private readonly props: LandingProps) {}

  static create(input: LandingCreateInput): Landing {
    if (!VALID_KINDS.includes(input.kind)) {
      throw new ValidationError(`kind inválido: "${input.kind}". Permitidos: ${VALID_KINDS.join(', ')}`)
    }
    // Valida slug (lanza si inválido)
    LandingSlug.create({ slug_base: input.slug_base, slug_suffix: input.slug_suffix })
    // Valida blocks shape
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    // Invariante: exactamente un lead-form
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length === 0) throw new ValidationError('La landing debe contener un bloque lead-form')
    if (leadForms.length > 1) throw new ValidationError('La landing debe tener un único bloque lead-form')

    const now = new Date().toISOString()
    return new Landing({
      id: input.id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      template_id: input.template_id,
      kind: input.kind,
      slug_base: input.slug_base,
      slug_suffix: input.slug_suffix,
      status: input.status ?? 'draft',
      blocks: v.data,
      brand_voice: input.brand_voice ?? null,
      lead_rules: input.lead_rules ?? null,
      seo_title: input.seo_title ?? null,
      seo_description: input.seo_description ?? null,
      og_image_url: input.og_image_url ?? null,
      published_version_id: null,
      published_at: null,
      published_by: null,
      last_review_note: null,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: LandingProps): Landing {
    return new Landing(props)
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get template_id() { return this.props.template_id }
  get kind() { return this.props.kind }
  get slug_base() { return this.props.slug_base }
  get slug_suffix() { return this.props.slug_suffix }
  get full_slug() { return `${this.props.slug_base}-${this.props.slug_suffix}` }
  get status(): LandingStatusValue { return this.props.status }
  get blocks(): Block[] { return this.props.blocks }
  get brand_voice() { return this.props.brand_voice }
  get lead_rules() { return this.props.lead_rules }
  get seo_title() { return this.props.seo_title }
  get seo_description() { return this.props.seo_description }
  get og_image_url() { return this.props.og_image_url }
  get published_version_id() { return this.props.published_version_id }
  get published_at() { return this.props.published_at }
  get published_by() { return this.props.published_by }
  get last_review_note() { return this.props.last_review_note }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): LandingProps { return { ...this.props, blocks: [...this.props.blocks] } }

  replaceBlocks(blocks: Block[]): Landing {
    const v = validateBlocks(blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length !== 1) throw new ValidationError('La landing debe tener un único bloque lead-form')
    return new Landing({ ...this.props, blocks: v.data, updated_at: new Date().toISOString() })
  }

  transitionStatus(next: LandingStatusValue): Landing {
    const current = LandingStatus.create(this.props.status)
    const transitioned = current.transitionTo(next)
    return new Landing({ ...this.props, status: transitioned.value, updated_at: new Date().toISOString() })
  }

  markPublished(args: { version_id: string; published_by: string; at?: string }): Landing {
    const current = LandingStatus.create(this.props.status)
    const transitioned = current.transitionTo('published')
    const now = args.at ?? new Date().toISOString()
    return new Landing({
      ...this.props,
      status: transitioned.value,
      published_version_id: args.version_id,
      published_at: now,
      published_by: args.published_by,
      updated_at: now,
    })
  }

  updateMetadata(args: Partial<Pick<LandingProps, 'brand_voice' | 'lead_rules' | 'seo_title' | 'seo_description' | 'og_image_url' | 'slug_base'>>): Landing {
    const next = { ...this.props, ...args, updated_at: new Date().toISOString() }
    if (args.slug_base !== undefined) {
      LandingSlug.create({ slug_base: next.slug_base, slug_suffix: next.slug_suffix })
    }
    return new Landing(next)
  }

  setReviewNote(note: string | null): Landing {
    return new Landing({ ...this.props, last_review_note: note, updated_at: new Date().toISOString() })
  }
}
