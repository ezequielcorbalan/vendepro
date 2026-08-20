/** Quién completó la ficha. Cambia cuánto confiar en los metros declarados. */
export type FichaFilledBy = 'agente' | 'propietario'

export interface FichaTasacionProps {
  id: string
  org_id: string
  agent_id: string
  lead_id: string | null
  appraisal_id: string | null
  /** Link público del que nació la ficha. NULL = cargada a mano por el agente. */
  ficha_link_id: string | null
  filled_by: FichaFilledBy
  /** NULL mientras el propietario no envió. Las del agente nacen con fecha. */
  submitted_at: string | null
  /**
   * Datos del propietario tal como los declaró. Se guardan además del contacto:
   * el link abierto puede llegar antes de que exista contacto, y editar el
   * contacto después no debe pisar lo que la persona escribió acá.
   */
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  inspection_date: string | null
  address: string
  neighborhood: string | null
  property_type: string | null
  floor_number: string | null
  /** Letra o número de unidad ("B", "104"). Complementa a floor_number. */
  unit: string | null
  /** Tipología declarada (1 = monoambiente … 5 = 5 o más). No son dormitorios. */
  rooms: number | null
  /** 'independiente' | 'integrada' */
  kitchen_type: string | null
  /** 'si' | 'no' | 'parcial' */
  furnished: string | null
  /** 'muy_luminoso' | 'luminoso' | 'poco_luminoso' */
  light_level: string | null
  /** 'no_tiene' | 'fija_cubierta' | 'fija_descubierta' | 'alquila_aparte' */
  parking_type: string | null
  /** 'si' | 'no' | 'a_convenir' */
  pets_allowed: string | null
  /** 'venta' | 'alquiler' | 'ambas' — qué quiere hacer el propietario. */
  operation: string | null
  /** Superficie del lote (casa, PH, terreno). */
  land_area: number | null
  /** Frente: del lote en un terreno, de la vidriera en un local. */
  frontage_m: number | null
  depth_m: number | null
  /** Zonificación declarada (terreno). */
  zoning: string | null
  /** Servicios en la puerta, coma-separado (terreno). */
  utilities: string | null
  /** Plantas (casa, PH). */
  floors_count: number | null
  /** Rubro habilitado (local, oficina). */
  commercial_use: string | null
  has_warehouse: string | null
  /** UF o número de la cochera; cambia escritura y precio. */
  parking_unit: string | null
  storage_unit: string | null
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

  /**
   * Los campos de la capa pública (041_) son opcionales: las fichas que carga
   * el agente y las históricas no los traen, y deben seguir construyéndose.
   */
  static create(
    props: Omit<
      FichaTasacionProps,
      | 'created_at' | 'updated_at' | 'ficha_link_id' | 'filled_by' | 'submitted_at'
      | 'owner_name' | 'owner_phone' | 'owner_email'
      | 'unit' | 'rooms' | 'kitchen_type' | 'furnished' | 'light_level'
      | 'parking_type' | 'pets_allowed'
      | 'operation' | 'land_area' | 'frontage_m' | 'depth_m' | 'zoning' | 'utilities'
      | 'floors_count' | 'commercial_use' | 'has_warehouse' | 'parking_unit' | 'storage_unit'
    > &
      Partial<
        Pick<
          FichaTasacionProps,
          | 'created_at' | 'updated_at' | 'ficha_link_id' | 'filled_by' | 'submitted_at'
          | 'owner_name' | 'owner_phone' | 'owner_email'
          | 'unit' | 'rooms' | 'kitchen_type' | 'furnished' | 'light_level'
          | 'parking_type' | 'pets_allowed'
      | 'operation' | 'land_area' | 'frontage_m' | 'depth_m' | 'zoning' | 'utilities'
      | 'floors_count' | 'commercial_use' | 'has_warehouse' | 'parking_unit' | 'storage_unit'
        >
      >,
  ): FichaTasacion {
    const now = new Date().toISOString()
    return new FichaTasacion({
      ...props,
      ficha_link_id: props.ficha_link_id ?? null,
      filled_by: props.filled_by ?? 'agente',
      // Una ficha del agente nace ya completada; la del propietario se marca al enviar.
      submitted_at: props.submitted_at ?? null,
      owner_name: props.owner_name ?? null,
      owner_phone: props.owner_phone ?? null,
      owner_email: props.owner_email ?? null,
      unit: props.unit ?? null,
      rooms: props.rooms ?? null,
      kitchen_type: props.kitchen_type ?? null,
      furnished: props.furnished ?? null,
      light_level: props.light_level ?? null,
      parking_type: props.parking_type ?? null,
      pets_allowed: props.pets_allowed ?? null,
      operation: props.operation ?? null,
      land_area: props.land_area ?? null,
      frontage_m: props.frontage_m ?? null,
      depth_m: props.depth_m ?? null,
      zoning: props.zoning ?? null,
      utilities: props.utilities ?? null,
      floors_count: props.floors_count ?? null,
      commercial_use: props.commercial_use ?? null,
      has_warehouse: props.has_warehouse ?? null,
      parking_unit: props.parking_unit ?? null,
      storage_unit: props.storage_unit ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get lead_id() { return this.props.lead_id }
  get appraisal_id() { return this.props.appraisal_id }
  get ficha_link_id() { return this.props.ficha_link_id }
  get filled_by() { return this.props.filled_by }
  get submitted_at() { return this.props.submitted_at }
  get address() { return this.props.address }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): FichaTasacionProps { return { ...this.props } }
}
