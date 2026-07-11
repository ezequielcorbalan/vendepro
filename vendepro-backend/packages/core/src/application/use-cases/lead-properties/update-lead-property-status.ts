import type { LeadPropertyRepository } from '../../ports/repositories/lead-property-repository'
import type { LeadPropertyStatus } from '../../../domain/entities/lead-property'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateLeadPropertyStatusInput {
  orgId: string
  id: string
  status?: LeadPropertyStatus
  feedback?: string | null
  notes?: string | null
}

export class UpdateLeadPropertyStatusUseCase {
  constructor(private readonly leadPropertyRepo: LeadPropertyRepository) {}

  async execute(input: UpdateLeadPropertyStatusInput): Promise<{ ok: true }> {
    const leadProperty = await this.leadPropertyRepo.findById(input.id, input.orgId)
    if (!leadProperty) throw new NotFoundError('Relación lead-propiedad no encontrada')

    if (input.status !== undefined) leadProperty.updateStatus(input.status, input.feedback)
    else if (input.feedback !== undefined) leadProperty.setFeedback(input.feedback)
    if (input.notes !== undefined) leadProperty.setNotes(input.notes)

    await this.leadPropertyRepo.save(leadProperty)
    return { ok: true }
  }
}
