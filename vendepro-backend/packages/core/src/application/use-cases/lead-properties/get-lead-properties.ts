import type { LeadPropertyRepository, LeadPropertyWithProperty } from '../../ports/repositories/lead-property-repository'

export interface GetLeadPropertiesInput {
  orgId: string
  leadId: string
}

/** Propiedades de interés de un lead, con los datos de la propiedad para la UI. */
export class GetLeadPropertiesUseCase {
  constructor(private readonly leadPropertyRepo: LeadPropertyRepository) {}

  async execute(input: GetLeadPropertiesInput): Promise<LeadPropertyWithProperty[]> {
    return this.leadPropertyRepo.findByLeadWithProperty(input.leadId, input.orgId)
  }
}
