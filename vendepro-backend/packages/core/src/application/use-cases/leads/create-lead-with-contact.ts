import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { CreateLeadUseCase, type CreateLeadInput } from './create-lead'
import { CreateContactUseCase, type CreateContactInput } from '../contacts/create-contact'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface CreateLeadWithContactInput {
  org_id: string
  assigned_to: string
  full_name?: string
  phone?: string | null
  email?: string | null
  source?: string
  source_detail?: string | null
  property_address?: string | null
  neighborhood?: string | null
  property_type?: string | null
  operation?: string
  notes?: string | null
  estimated_value?: number | null
  budget?: number | null
  timing?: string | null
  personas_trabajo?: string | null
  mascotas?: string | null
  next_step?: string | null
  next_step_date?: string | null
  contact_id?: string | null
  contact_data?: {
    full_name: string
    phone?: string | null
    email?: string | null
    agent_id?: string
    contact_type?: string
    source?: string | null
    neighborhood?: string | null
    notes?: string | null
  }
}

export class CreateLeadWithContactUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly contactRepo: ContactRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateLeadWithContactInput): Promise<{ id: string; contact_id: string }> {
    let contactId = input.contact_id ?? undefined

    if (!contactId && input.contact_data) {
      const createContact = new CreateContactUseCase(this.contactRepo, this.ids)
      const result = await createContact.execute({
        ...input.contact_data,
        org_id: input.org_id,
        agent_id: input.contact_data.agent_id ?? input.assigned_to,
      } as CreateContactInput)
      contactId = result.id
    }

    if (!contactId) {
      throw new ValidationError('Se requiere contact_id o contact_data')
    }

    const createLead = new CreateLeadUseCase(this.leadRepo, this.ids)
    const leadResult = await createLead.execute({
      ...input,
      full_name: input.full_name ?? input.contact_data?.full_name ?? '',
      source: input.source ?? 'manual',
      contact_id: contactId,
    } as CreateLeadInput)

    return { id: leadResult.id, contact_id: contactId }
  }
}
