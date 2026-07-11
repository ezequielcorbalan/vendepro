import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { LeadPropertyRepository } from '../../ports/repositories/lead-property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LeadProperty } from '../../../domain/entities/lead-property'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface LinkLeadPropertyInput {
  orgId: string
  leadId: string
  propertyId: string
  notes?: string | null
}

/**
 * Vincula una propiedad de interés a un lead. Idempotente: si la relación ya
 * existe devuelve created:false sin tocar su status (puede estar 'visitada').
 * No exige pipeline comprador: la UI solo lo expone para compradores, pero un
 * vendedor interesado en stock no rompe ningún invariante.
 */
export class LinkLeadPropertyUseCase {
  constructor(
    private readonly leadPropertyRepo: LeadPropertyRepository,
    private readonly leadRepo: LeadRepository,
    private readonly propertyRepo: PropertyRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: LinkLeadPropertyInput): Promise<{ id: string; created: boolean }> {
    const lead = await this.leadRepo.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    const property = await this.propertyRepo.findById(input.propertyId, input.orgId)
    if (!property) throw new NotFoundError('Propiedad no encontrada')

    const existing = await this.leadPropertyRepo.findByLeadAndProperty(input.leadId, input.propertyId, input.orgId)
    if (existing) return { id: existing.id, created: false }

    const leadProperty = LeadProperty.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      lead_id: input.leadId,
      property_id: input.propertyId,
      notes: input.notes ?? null,
      feedback: null,
    })
    await this.leadPropertyRepo.save(leadProperty)
    return { id: leadProperty.id, created: true }
  }
}
