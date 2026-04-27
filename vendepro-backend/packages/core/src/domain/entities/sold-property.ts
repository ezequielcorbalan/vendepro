import { ValidationError } from '../errors/validation-error'

export type SoldPropertyOrigin = 'mine' | 'team' | 'external'

export interface SoldPropertyProps {
  id: string
  org_id: string

  property_type: string
  neighborhood: string | null
  address_approx: string | null

  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking: number | null

  listing_price_usd: number | null
  closing_price_usd: number | null
  closed_at: string | null

  notes: string | null

  agent_id: string | null
  external_agent_name: string | null
  external_agency: string | null

  photos: string[]

  shared_with_network: boolean

  created_by: string | null
  created_at: string
  updated_at: string
}

export class SoldProperty {
  private constructor(private props: SoldPropertyProps) {}

  static create(
    input: Omit<SoldPropertyProps, 'created_at' | 'updated_at' | 'photos' | 'shared_with_network'> & {
      photos?: string[]
      shared_with_network?: boolean
      created_at?: string
      updated_at?: string
    },
  ): SoldProperty {
    if (!input.id || !input.org_id) {
      throw new ValidationError('id y org_id son requeridos')
    }
    if (!input.property_type || input.property_type.trim().length === 0) {
      throw new ValidationError('property_type es requerido')
    }
    // Origen: tiene que tener agent_id O external_agent_name
    const hasOwner = !!input.agent_id || !!(input.external_agent_name && input.external_agent_name.trim())
    if (!hasOwner) {
      throw new ValidationError('Indicá un agente del equipo o un colega externo')
    }
    const now = new Date().toISOString()
    return new SoldProperty({
      ...input,
      photos: input.photos ?? [],
      shared_with_network: input.shared_with_network ?? false,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: SoldPropertyProps): SoldProperty {
    return new SoldProperty({ ...props })
  }

  // Getters
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get property_type() { return this.props.property_type }
  get neighborhood() { return this.props.neighborhood }
  get address_approx() { return this.props.address_approx }
  get covered_area() { return this.props.covered_area }
  get total_area() { return this.props.total_area }
  get semi_area() { return this.props.semi_area }
  get rooms() { return this.props.rooms }
  get bedrooms() { return this.props.bedrooms }
  get bathrooms() { return this.props.bathrooms }
  get parking() { return this.props.parking }
  get listing_price_usd() { return this.props.listing_price_usd }
  get closing_price_usd() { return this.props.closing_price_usd }
  get closed_at() { return this.props.closed_at }
  get notes() { return this.props.notes }
  get agent_id() { return this.props.agent_id }
  get external_agent_name() { return this.props.external_agent_name }
  get external_agency() { return this.props.external_agency }
  get photos() { return this.props.photos }
  get shared_with_network() { return this.props.shared_with_network }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  /** Origen relativo a un usuario consultor. */
  originFor(currentUserId: string | null): SoldPropertyOrigin {
    if (this.props.agent_id && currentUserId && this.props.agent_id === currentUserId) return 'mine'
    if (this.props.agent_id) return 'team'
    return 'external'
  }

  /** USD/m² calculado (cubierta o total como fallback). */
  get usdPerM2(): number | null {
    const price = this.props.closing_price_usd
    const area = this.props.covered_area ?? this.props.total_area
    if (!price || !area) return null
    return Math.round(price / area)
  }

  update(patch: Partial<Omit<SoldPropertyProps, 'id' | 'org_id' | 'created_at' | 'created_by'>>): void {
    Object.assign(this.props, patch)
    this.props.updated_at = new Date().toISOString()
  }

  addPhoto(url: string): void {
    if (!url) return
    if (this.props.photos.includes(url)) return
    this.props.photos = [...this.props.photos, url]
    this.props.updated_at = new Date().toISOString()
  }

  removePhoto(url: string): void {
    this.props.photos = this.props.photos.filter(p => p !== url)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): SoldPropertyProps {
    return { ...this.props, photos: [...this.props.photos] }
  }
}
