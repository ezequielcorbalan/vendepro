import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { IdGenerator } from '../../ports/id-generator'
import type { LeadPipeline } from '../../../domain/value-objects/lead-stage'
import { Lead } from '../../../domain/entities/lead'
import { parseMoneyOrNull } from '../../../shared/utils'

export interface CreateLeadInput {
  org_id: string
  /** 'vendedor' (default) | 'comprador' */
  pipeline?: LeadPipeline
  full_name: string
  phone?: string | null
  email?: string | null
  source: string
  source_detail?: string | null
  property_address?: string | null
  neighborhood?: string | null
  property_type?: string
  operation?: string
  assigned_to: string | null
  notes?: string | null
  estimated_value?: string | null
  next_step?: string | null
  next_step_date?: string | null
  budget?: number | null
  timing?: string | null
  contact_id?: string | null
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
      phone: input.phone ?? null,
      email: input.email ?? null,
      source: input.source,
      source_detail: input.source_detail ?? null,
      property_address: input.property_address ?? null,
      neighborhood: input.neighborhood ?? null,
      property_type: input.property_type ?? 'departamento',
      operation: input.operation ?? 'venta',
      pipeline: input.pipeline ?? 'vendedor',
      stage: 'nuevo',
      assigned_to: input.assigned_to ?? null,
      notes: input.notes ?? null,
      estimated_value: parseMoneyOrNull(input.estimated_value),
      budget: input.budget ?? null,
      timing: input.timing ?? null,
      personas_trabajo: null,
      mascotas: null,
      next_step: input.next_step ?? null,
      next_step_date: input.next_step_date ?? null,
      lost_reason: null,
      first_contact_at: null,
      contact_id: input.contact_id ?? null,
    })

    await this.leadRepo.save(lead)
    return { id: lead.id }
  }
}
