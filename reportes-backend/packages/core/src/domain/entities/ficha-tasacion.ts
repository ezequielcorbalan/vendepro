export interface FichaTasacionProps {
  id: string
  org_id: string
  agent_id: string
  lead_id: string | null
  appraisal_id: string | null
  inspection_date: string | null
  address: string
  neighborhood: string | null
  property_type: string | null
  floor_number: string | null
  elevators: string | null
  age: string | null
  building_category: string | null
  property_condition: string | null
  covered_area: number | null
  semi_area: number | null
  uncovered_area: number | null
  m2_value_neighborhood: number | null
  m2_value_zone: number | null
  bedrooms: number | null
  bathrooms: number | null
  storage_rooms: number | null
  parking_spots: number | null
  air_conditioning: number | null
  bedroom_dimensions: string | null
  living_dimensions: string | null
  kitchen_dimensions: string | null
  bathroom_dimensions: string | null
  floor_type: string | null
  disposition: string | null
  orientation: string | null
  balcony_type: string | null
  heating_type: string | null
  noise_level: string | null
  amenities: string | null
  is_professional: number
  is_occupied: number
  is_credit_eligible: number
  sells_to_buy: number
  expenses: number | null
  abl: number | null
  aysa: number | null
  notes: string | null
  photos: string | null
  created_at: string
  updated_at: string
}

export class FichaTasacion {
  private constructor(private props: FichaTasacionProps) {}

  static create(props: Omit<FichaTasacionProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): FichaTasacion {
    const now = new Date().toISOString()
    return new FichaTasacion({ ...props, created_at: props.created_at ?? now, updated_at: props.updated_at ?? now })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get lead_id() { return this.props.lead_id }
  get appraisal_id() { return this.props.appraisal_id }
  get address() { return this.props.address }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): FichaTasacionProps { return { ...this.props } }
}
