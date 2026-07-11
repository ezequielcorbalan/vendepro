import type { LeadPropertyRepository } from '../../ports/repositories/lead-property-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UnlinkLeadPropertyInput {
  orgId: string
  id: string
}

export class UnlinkLeadPropertyUseCase {
  constructor(private readonly leadPropertyRepo: LeadPropertyRepository) {}

  async execute(input: UnlinkLeadPropertyInput): Promise<{ ok: true }> {
    const existing = await this.leadPropertyRepo.findById(input.id, input.orgId)
    if (!existing) throw new NotFoundError('Relación lead-propiedad no encontrada')
    await this.leadPropertyRepo.delete(input.id, input.orgId)
    return { ok: true }
  }
}
