import type { LeadRepository, LeadFilters } from '../../ports/repositories/lead-repository'
import type { Lead } from '../../../domain/entities/lead'

export class GetLeadsUseCase {
  constructor(private readonly leadRepo: LeadRepository) {}

  async execute(orgId: string, filters?: LeadFilters): Promise<Lead[]> {
    return this.leadRepo.findByOrg(orgId, filters)
  }
}
