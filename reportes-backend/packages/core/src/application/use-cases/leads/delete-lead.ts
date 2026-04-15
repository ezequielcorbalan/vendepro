import type { LeadRepository } from '../../ports/repositories/lead-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export class DeleteLeadUseCase {
  constructor(private readonly leadRepo: LeadRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    const lead = await this.leadRepo.findById(id, orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')
    await this.leadRepo.delete(id, orgId)
  }
}
