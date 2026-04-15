import type { LeadRepository } from '../../ports/repositories/lead-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateLeadInput {
  id: string
  orgId: string
  full_name?: string
  phone?: string
  email?: string | null
  neighborhood?: string | null
  property_type?: string
  operation?: string
  notes?: string | null
  budget?: number | null
  timing?: string | null
  personas_trabajo?: number | null
  mascotas?: number | null
  next_step?: string | null
  next_step_date?: string | null
  assigned_to?: string
}

export class UpdateLeadUseCase {
  constructor(private readonly leadRepo: LeadRepository) {}

  async execute(input: UpdateLeadInput): Promise<void> {
    const lead = await this.leadRepo.findById(input.id, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    const { id, orgId, ...data } = input
    lead.update(data)
    await this.leadRepo.save(lead)
  }
}
