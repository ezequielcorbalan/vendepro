import type { SoldPropertyRepository } from '../../ports/repositories/sold-property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { SoldProperty } from '../../../domain/entities/sold-property'

export interface CreateSoldPropertyInput {
  org_id: string
  created_by: string

  property_type: string
  neighborhood?: string | null
  address_approx?: string | null

  covered_area?: number | null
  total_area?: number | null
  semi_area?: number | null
  rooms?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  parking?: number | null

  listing_price_usd?: number | null
  closing_price_usd?: number | null
  closed_at?: string | null

  notes?: string | null

  agent_id?: string | null
  external_agent_name?: string | null
  external_agency?: string | null

  photos?: string[]
  shared_with_network?: boolean
}

export class CreateSoldPropertyUseCase {
  constructor(
    private readonly repo: SoldPropertyRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateSoldPropertyInput): Promise<{ id: string }> {
    const sp = SoldProperty.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      property_type: input.property_type,
      neighborhood: input.neighborhood ?? null,
      address_approx: input.address_approx ?? null,
      covered_area: input.covered_area ?? null,
      total_area: input.total_area ?? null,
      semi_area: input.semi_area ?? null,
      rooms: input.rooms ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      parking: input.parking ?? null,
      listing_price_usd: input.listing_price_usd ?? null,
      closing_price_usd: input.closing_price_usd ?? null,
      closed_at: input.closed_at ?? null,
      notes: input.notes ?? null,
      agent_id: input.agent_id ?? null,
      external_agent_name: input.external_agent_name ?? null,
      external_agency: input.external_agency ?? null,
      photos: input.photos ?? [],
      shared_with_network: input.shared_with_network ?? false,
      created_by: input.created_by ?? null,
    })
    await this.repo.save(sp)
    return { id: sp.id }
  }
}
