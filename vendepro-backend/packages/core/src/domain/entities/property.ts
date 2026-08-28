import { ValidationError } from '../errors/validation-error'
import type { PropertyStatus } from '../rules/property-rules'
import type { Currency } from '../value-objects/money'
import { canTransitionPropertyStatus } from '../rules/property-rules'

export type PropertyType = 'departamento' | 'casa' | 'ph' | 'local' | 'terreno' | 'oficina'
/** Origen del alta: cargada en VendéPro o importada por el sync de KiteProp. */
export type PropertySource = 'manual' | 'kiteprop'

export interface PropertyProps {
  id: string
  address: string
  neighborhood: string
  city: string
  property_type: PropertyType
  rooms: number | null
  size_m2: number | null
  asking_price: number | null
  currency: Currency
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  contact_id: string | null
  public_slug: string
  cover_photo: string | null
  agent_id: string | null
  org_id: string
  status: PropertyStatus
  source?: PropertySource
  commercial_stage: string | null
  operation_type: string
  operation_type_id: number
  commercial_stage_id: number | null
  status_id: number
  // `contact_id` ya está declarado arriba como `string | null`. Estaba repetido
  // acá como opcional, lo que rompía el tipo (TS2300/2687/2717).
  lead_id?: string | null
  auth_start_date?: string | null
  auth_duration_days?: number | null
  doc_status_json?: string | null
  created_at: string
  updated_at: string
  // Computed / Joined
  agent_name?: string
  report_count?: number
  last_external_report_at?: string | null
  last_report_at?: string | null
}

const VALID_PROPERTY_TYPES: PropertyType[] = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina']

export class Property {
  private constructor(private props: PropertyProps) {}

  static create(props: Omit<PropertyProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Property {
    if (!props.address?.trim()) throw new ValidationError('Dirección es requerida')
    if (!props.neighborhood?.trim()) throw new ValidationError('Barrio es requerido')
    if (!props.owner_name?.trim()) throw new ValidationError('Nombre del propietario es requerido')
    if (!VALID_PROPERTY_TYPES.includes(props.property_type)) {
      throw new ValidationError(`Tipo de propiedad inválido: "${props.property_type}"`)
    }
    if (!props.public_slug?.trim()) throw new ValidationError('Slug público es requerido')
    const now = new Date().toISOString()
    return new Property({
      ...props,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // Getters
  get id() { return this.props.id }
  get address() { return this.props.address }
  get neighborhood() { return this.props.neighborhood }
  get city() { return this.props.city }
  get property_type() { return this.props.property_type }
  get rooms() { return this.props.rooms }
  get size_m2() { return this.props.size_m2 }
  get asking_price() { return this.props.asking_price }
  get currency() { return this.props.currency }
  get owner_name() { return this.props.owner_name }
  get owner_phone() { return this.props.owner_phone }
  get owner_email() { return this.props.owner_email }
  get contact_id() { return this.props.contact_id }
  get public_slug() { return this.props.public_slug }
  get cover_photo() { return this.props.cover_photo }
  get agent_id() { return this.props.agent_id }
  get org_id() { return this.props.org_id }
  get status() { return this.props.status }
  get source() { return this.props.source ?? 'manual' }
  get commercial_stage() { return this.props.commercial_stage }
  get operation_type() { return this.props.operation_type }
  get operation_type_id() { return this.props.operation_type_id }
  get commercial_stage_id() { return this.props.commercial_stage_id }
  get status_id() { return this.props.status_id }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }
  get agent_name() { return this.props.agent_name }
  get report_count() { return this.props.report_count }
  get auth_start_date() { return this.props.auth_start_date ?? null }
  get auth_duration_days() { return this.props.auth_duration_days ?? null }
  get doc_status_json() { return this.props.doc_status_json ?? null }
  get lead_id() { return this.props.lead_id ?? null }

  // Domain methods
  updateStatus(newStatus: PropertyStatus): void {
    if (!canTransitionPropertyStatus(this.props.status, newStatus)) {
      throw new ValidationError(`Transición inválida de estado "${this.props.status}" a "${newStatus}"`)
    }
    this.props.status = newStatus
    this.props.updated_at = new Date().toISOString()
  }

  updatePrice(newPrice: number, currency: Currency): void {
    if (!Number.isFinite(newPrice) || newPrice <= 0) {
      throw new ValidationError('El precio debe ser un número positivo')
    }
    this.props.asking_price = newPrice
    this.props.currency = currency
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): PropertyProps {
    return { ...this.props }
  }
}
