import { ValidationError } from '../errors/validation-error'

export type AppraisalStatus = 'draft' | 'generated' | 'sent'

export interface AppraisalComparableProps {
  id: string
  appraisal_id: string
  zonaprop_url: string | null
  address: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  days_on_market: number | null
  views_per_day: number | null
  age: number | null
  sort_order: number
}

export interface AppraisalProposalBlock {
  title?: string
  subtitle?: string | null
  body?: string | null
  show_agent_signature?: boolean
}

export interface AppraisalMarketSituationBlock {
  title?: string
  body?: string | null
  media_urls?: string[]
}

export interface AppraisalWorkConditionsBlock {
  honorarios_pct?: number | null
  honorarios_usd?: number | null
  exclusividad?: boolean
  exclusividad_meses?: number | null
  extras?: string[]
  legal_text?: string | null
}

export interface AppraisalProps {
  id: string
  org_id: string
  property_address: string
  neighborhood: string
  city: string
  property_type: string
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  weighted_area: number | null
  strengths: string | null
  weaknesses: string | null
  opportunities: string | null
  threats: string | null
  publication_analysis: string | null
  suggested_price: number | null
  test_price: number | null
  expected_close_price: number | null
  usd_per_m2: number | null
  template_id: string | null
  template_snapshot_json: unknown | null
  template_synced_at: string | null
  block_overrides_json: Record<string, unknown> | null
  agent_id: string
  lead_id: string | null
  status: AppraisalStatus
  public_slug: string | null
  // New block fields (stored as JSON text columns in D1)
  proposal: AppraisalProposalBlock | null
  market_situation: AppraisalMarketSituationBlock | null
  work_conditions: AppraisalWorkConditionsBlock | null
  video_links: string[] | null
  created_at: string
  updated_at: string
  // Joined
  comparables?: AppraisalComparableProps[]
  agent_name?: string
}

const VALID_STATUSES: AppraisalStatus[] = ['draft', 'generated', 'sent']

export class Appraisal {
  private constructor(private props: AppraisalProps) {}

  static create(
    props: Omit<AppraisalProps, 'created_at' | 'updated_at' | 'proposal' | 'market_situation' | 'work_conditions' | 'video_links' | 'template_id' | 'template_snapshot_json' | 'template_synced_at' | 'block_overrides_json'>
      & {
        created_at?: string
        updated_at?: string
        proposal?: AppraisalProposalBlock | null
        market_situation?: AppraisalMarketSituationBlock | null
        work_conditions?: AppraisalWorkConditionsBlock | null
        video_links?: string[] | null
        template_id?: string | null
        template_snapshot_json?: unknown | null
        template_synced_at?: string | null
        block_overrides_json?: Record<string, unknown> | null
      },
  ): Appraisal {
    if (!props.property_address?.trim()) throw new ValidationError('Dirección es requerida')
    if (!props.neighborhood?.trim()) throw new ValidationError('Barrio es requerido')
    if (!VALID_STATUSES.includes(props.status)) throw new ValidationError(`Estado inválido: "${props.status}"`)
    const now = new Date().toISOString()
    return new Appraisal({
      ...props,
      proposal: props.proposal ?? null,
      market_situation: props.market_situation ?? null,
      work_conditions: props.work_conditions ?? null,
      video_links: props.video_links ?? null,
      template_id: props.template_id ?? null,
      template_snapshot_json: props.template_snapshot_json ?? null,
      template_synced_at: props.template_synced_at ?? null,
      block_overrides_json: props.block_overrides_json ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_address() { return this.props.property_address }
  get neighborhood() { return this.props.neighborhood }
  get city() { return this.props.city }
  get property_type() { return this.props.property_type }
  get covered_area() { return this.props.covered_area }
  get total_area() { return this.props.total_area }
  get semi_area() { return this.props.semi_area }
  get weighted_area() { return this.props.weighted_area }
  get strengths() { return this.props.strengths }
  get weaknesses() { return this.props.weaknesses }
  get opportunities() { return this.props.opportunities }
  get threats() { return this.props.threats }
  get publication_analysis() { return this.props.publication_analysis }
  get suggested_price() { return this.props.suggested_price }
  get test_price() { return this.props.test_price }
  get expected_close_price() { return this.props.expected_close_price }
  get usd_per_m2() { return this.props.usd_per_m2 }
  get template_id() { return this.props.template_id }
  get template_snapshot_json() { return this.props.template_snapshot_json }
  get template_synced_at() { return this.props.template_synced_at }
  get block_overrides_json() { return this.props.block_overrides_json }
  get agent_id() { return this.props.agent_id }
  get lead_id() { return this.props.lead_id }
  get status() { return this.props.status }
  get public_slug() { return this.props.public_slug }
  get proposal() { return this.props.proposal }
  get market_situation() { return this.props.market_situation }
  get work_conditions() { return this.props.work_conditions }
  get video_links() { return this.props.video_links }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }
  get comparables() { return this.props.comparables }
  get agent_name() { return this.props.agent_name }

  update(data: Partial<Omit<AppraisalProps, 'id' | 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, data)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): AppraisalProps {
    return { ...this.props }
  }
}
