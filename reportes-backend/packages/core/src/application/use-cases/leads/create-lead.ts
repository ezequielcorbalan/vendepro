import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Lead } from '../../../domain/entities/lead'

export interface CreateLeadInput {
  org_id: string
  full_name: string
  phone: string
  email?: string | null
  source: string
  source_detail?: string | null
  property_address?: string | null
  neighborhood?: string | null
  property_type?: string
  operation?: string
  assigned_to: string
  notes?: string | null
  budget?: number | null
}

export class CreateLeadUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateLeadInput): Promise<{ id: string }> {
    const lead = Lead.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email ?? null,
      source: input.source,
      source_detail: input.source_detail ?? null,
      property_address: input.property_address ?? null,
      neighborhood: input.neighborhood ?? null,
      property_type: input.property_type ?? 'departamento',
      operation: input.operation ?? 'venta',
      stage: 'nuevo',
      assigned_to: input.assigned_to,
      notes: input.notes ?? null,
      estimated_value: null,
      budget: input.budget ?? null,
      timing: null,
      personas_trabajo: null,
      mascotas: null,
      next_step: null,
      next_step_date: null,
      lost_reason: null,
      first_contact_at: null,
    })

    await this.leadRepo.save(lead)
    return { id: lead.id }
  }
}
