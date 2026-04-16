import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Property } from '../../../domain/entities/property'
import { slugify } from '../../../shared/utils'

export interface CreatePropertyInput {
  org_id: string
  agent_id: string
  address: string
  neighborhood: string
  city: string
  property_type: string
  rooms?: number | null
  size_m2?: number | null
  asking_price?: number | null
  currency?: string
  owner_name: string
  owner_phone: string
  owner_email?: string | null
  cover_photo?: string | null
  contact_id?: string | null
  lead_id?: string | null
}

export class CreatePropertyUseCase {
  constructor(
    private readonly propertyRepo: PropertyRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreatePropertyInput): Promise<{ id: string }> {
    const id = this.idGen.generate()
    const slug = slugify(`${input.address}-${input.neighborhood}`) + '-' + id.slice(0, 6)

    const property = Property.create({
      id,
      org_id: input.org_id,
      agent_id: input.agent_id,
      address: input.address,
      neighborhood: input.neighborhood,
      city: input.city,
      property_type: input.property_type as any,
      rooms: input.rooms ?? null,
      size_m2: input.size_m2 ?? null,
      asking_price: input.asking_price ?? null,
      currency: (input.currency ?? 'USD') as any,
      owner_name: input.owner_name,
      owner_phone: input.owner_phone,
      owner_email: input.owner_email ?? null,
      public_slug: slug,
      cover_photo: input.cover_photo ?? null,
      status: 'active',
      commercial_stage: null,
      contact_id: input.contact_id ?? null,
      lead_id: input.lead_id ?? null,
    })

    await this.propertyRepo.save(property)
    return { id: property.id }
  }
}
