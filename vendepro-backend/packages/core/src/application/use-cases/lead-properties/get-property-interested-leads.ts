import type { LeadPropertyRepository, InterestedLeadRow } from '../../ports/repositories/lead-property-repository'

export interface GetPropertyInterestedLeadsInput {
  orgId: string
  propertyId: string
}

/** Leads (compradores) interesados en una propiedad — pestaña "Interesados". */
export class GetPropertyInterestedLeadsUseCase {
  constructor(private readonly leadPropertyRepo: LeadPropertyRepository) {}

  async execute(input: GetPropertyInterestedLeadsInput): Promise<InterestedLeadRow[]> {
    return this.leadPropertyRepo.findInterestedByProperty(input.propertyId, input.orgId)
  }
}
