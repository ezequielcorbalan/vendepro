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
  canva_design_id: string | null
  canva_edit_url: string | null
  agent_id: string
  lead_id: string | null
  status: AppraisalStatus
  public_slug: string | null
  created_at: string
  updated_at: string
  // Joined
  comparables?: AppraisalComparableProps[]
  agent_name?: string
}

const VALID_STATUSES: AppraisalStatus[] = ['draft', 'generated', 'sent']

export class Appraisal {
  private constructor(private props: AppraisalProps) {}

  static create(props: Omit<AppraisalProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Appraisal {
    if (!props.property_address?.trim()) throw new ValidationError('Dirección es requerida')
    if (!props.neighborhood?.trim()) throw new ValidationError('Barrio es requerido')
    if (!VALID_STATUSES.includes(props.status)) throw new ValidationError(`Estado inválido: "${props.status}"`)
    const now = new Date().toISOString()
    return new Appraisal({
      ...props,
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
  get canva_design_id() { return this.props.canva_design_id }
  get canva_edit_url() { return this.props.canva_edit_url }
  get agent_id() { return this.props.agent_id }
  get lead_id() { return this.props.lead_id }
  get status() { return this.props.status }
  get public_slug() { return this.props.public_slug }
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
