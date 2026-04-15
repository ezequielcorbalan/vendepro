export type PrefactStatus = 'draft' | 'generated' | 'sent'

export interface PrefactibilidadProps {
  id: string
  org_id: string
  agent_id: string
  lead_id: string | null
  public_slug: string | null
  status: PrefactStatus
  address: string
  neighborhood: string | null
  city: string
  lot_area: number | null
  lot_frontage: number | null
  lot_depth: number | null
  zoning: string | null
  fot: number | null
  fos: number | null
  max_height: string | null
  lot_price: number | null
  lot_price_per_m2: number | null
  lot_description: string | null
  lot_photos: string | null
  project_name: string | null
  project_description: string | null
  buildable_area: number | null
  total_units: number | null
  units_mix: string | null
  parking_spots: number | null
  amenities: string | null
  project_renders: string | null
  construction_cost_per_m2: number | null
  total_construction_cost: number | null
  professional_fees: number | null
  permits_cost: number | null
  commercialization_cost: number | null
  other_costs: number | null
  total_investment: number | null
  avg_sale_price_per_m2: number | null
  total_sellable_area: number | null
  projected_revenue: number | null
  gross_margin: number | null
  margin_pct: number | null
  tir: number | null
  payback_months: number | null
  comparables: string | null
  timeline: string | null
  executive_summary: string | null
  recommendation: string | null
  video_url: string | null
  agent_notes: string | null
  created_at: string
  updated_at: string
}

export class Prefactibilidad {
  private constructor(private props: PrefactibilidadProps) {}

  static create(props: Omit<PrefactibilidadProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Prefactibilidad {
    const now = new Date().toISOString()
    return new Prefactibilidad({ ...props, created_at: props.created_at ?? now, updated_at: props.updated_at ?? now })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get lead_id() { return this.props.lead_id }
  get public_slug() { return this.props.public_slug }
  get status() { return this.props.status }
  get address() { return this.props.address }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(data: Partial<Omit<PrefactibilidadProps, 'id' | 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, data)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): PrefactibilidadProps { return { ...this.props } }
}
