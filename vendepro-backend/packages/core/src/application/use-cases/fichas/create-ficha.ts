import type { FichaRepository } from '../../ports/repositories/ficha-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { FichaTasacion, type FichaFilledBy } from '../../../domain/entities/ficha-tasacion'

export interface CreateFichaInput {
  org_id: string
  agent_id: string
  lead_id?: string | null
  appraisal_id?: string | null
  inspection_date?: string | null
  address: string
  neighborhood?: string | null
  property_type?: string | null
  floor_number?: string | null
  elevators?: string | null
  age?: string | null
  building_category?: string | null
  property_condition?: string | null
  covered_area?: number | null
  semi_area?: number | null
  uncovered_area?: number | null
  m2_value_neighborhood?: number | null
  m2_value_zone?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  storage_rooms?: number | null
  parking_spots?: number | null
  air_conditioning?: number | null
  bedroom_dimensions?: string | null
  living_dimensions?: string | null
  kitchen_dimensions?: string | null
  bathroom_dimensions?: string | null
  floor_type?: string | null
  disposition?: string | null
  orientation?: string | null
  balcony_type?: string | null
  heating_type?: string | null
  noise_level?: string | null
  amenities?: string | null
  is_professional?: number
  is_occupied?: number
  is_credit_eligible?: number
  sells_to_buy?: number
  expenses?: number | null
  abl?: number | null
  aysa?: number | null
  notes?: string | null
  photos?: string | null
  // ── Capa pública (041_): sólo las completa SubmitPublicFichaUseCase ──
  ficha_link_id?: string | null
  filled_by?: FichaFilledBy
  submitted_at?: string | null
  owner_name?: string | null
  owner_phone?: string | null
  owner_email?: string | null
  unit?: string | null
  rooms?: number | null
  kitchen_type?: string | null
  furnished?: string | null
  light_level?: string | null
  parking_type?: string | null
  pets_allowed?: string | null
  // ── Preguntas que sólo aplican a algunos tipos de propiedad (042_) ──
  operation?: string | null
  land_area?: number | null
  frontage_m?: number | null
  depth_m?: number | null
  zoning?: string | null
  utilities?: string | null
  floors_count?: number | null
  commercial_use?: string | null
  has_warehouse?: string | null
  parking_unit?: string | null
  storage_unit?: string | null
}

export class CreateFichaUseCase {
  constructor(
    private readonly repo: FichaRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateFichaInput): Promise<{ id: string }> {
    if (!input.address || !input.address.trim()) {
      const err = new Error('address is required')
      ;(err as any).statusCode = 400
      throw err
    }

    const id = this.idGen.generate()
    const ficha = FichaTasacion.create({
      id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      lead_id: input.lead_id ?? null,
      appraisal_id: input.appraisal_id ?? null,
      ficha_link_id: input.ficha_link_id ?? null,
      filled_by: input.filled_by ?? 'agente',
      // La ficha del agente nace completa; la del propietario sella su fecha al enviar.
      submitted_at: input.submitted_at ?? null,
      owner_name: input.owner_name ?? null,
      owner_phone: input.owner_phone ?? null,
      owner_email: input.owner_email ?? null,
      unit: input.unit ?? null,
      rooms: input.rooms ?? null,
      kitchen_type: input.kitchen_type ?? null,
      furnished: input.furnished ?? null,
      light_level: input.light_level ?? null,
      parking_type: input.parking_type ?? null,
      pets_allowed: input.pets_allowed ?? null,
      operation: input.operation ?? null,
      land_area: input.land_area ?? null,
      frontage_m: input.frontage_m ?? null,
      depth_m: input.depth_m ?? null,
      zoning: input.zoning ?? null,
      utilities: input.utilities ?? null,
      floors_count: input.floors_count ?? null,
      commercial_use: input.commercial_use ?? null,
      has_warehouse: input.has_warehouse ?? null,
      parking_unit: input.parking_unit ?? null,
      storage_unit: input.storage_unit ?? null,
      inspection_date: input.inspection_date ?? null,
      address: input.address.trim(),
      neighborhood: input.neighborhood ?? null,
      property_type: input.property_type ?? null,
      floor_number: input.floor_number ?? null,
      elevators: input.elevators ?? null,
      age: input.age ?? null,
      building_category: input.building_category ?? null,
      property_condition: input.property_condition ?? null,
      covered_area: input.covered_area ?? null,
      semi_area: input.semi_area ?? null,
      uncovered_area: input.uncovered_area ?? null,
      m2_value_neighborhood: input.m2_value_neighborhood ?? null,
      m2_value_zone: input.m2_value_zone ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      storage_rooms: input.storage_rooms ?? null,
      parking_spots: input.parking_spots ?? null,
      air_conditioning: input.air_conditioning ?? null,
      bedroom_dimensions: input.bedroom_dimensions ?? null,
      living_dimensions: input.living_dimensions ?? null,
      kitchen_dimensions: input.kitchen_dimensions ?? null,
      bathroom_dimensions: input.bathroom_dimensions ?? null,
      floor_type: input.floor_type ?? null,
      disposition: input.disposition ?? null,
      orientation: input.orientation ?? null,
      balcony_type: input.balcony_type ?? null,
      heating_type: input.heating_type ?? null,
      noise_level: input.noise_level ?? null,
      amenities: input.amenities ?? null,
      is_professional: input.is_professional ?? 0,
      is_occupied: input.is_occupied ?? 0,
      is_credit_eligible: input.is_credit_eligible ?? 0,
      sells_to_buy: input.sells_to_buy ?? 0,
      expenses: input.expenses ?? null,
      abl: input.abl ?? null,
      aysa: input.aysa ?? null,
      notes: input.notes ?? null,
      photos: input.photos ?? null,
    })
    await this.repo.save(ficha)
    return { id }
  }
}
