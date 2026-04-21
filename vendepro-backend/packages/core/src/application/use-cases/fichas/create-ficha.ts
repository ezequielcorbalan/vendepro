import type { FichaRepository } from '../../ports/repositories/ficha-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { FichaTasacion } from '../../../domain/entities/ficha-tasacion'

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
