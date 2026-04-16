import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Contact } from '../../../domain/entities/contact'

export interface CreateContactInput {
  org_id: string
  full_name: string
  phone?: string | null
  email?: string | null
  contact_type?: string | null
  neighborhood?: string | null
  source?: string | null
  notes?: string | null
  agent_id: string
}

export class CreateContactUseCase {
  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateContactInput): Promise<{ id: string }> {
    const contact = Contact.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      contact_type: input.contact_type ?? 'propietario',
      neighborhood: input.neighborhood ?? null,
      source: input.source ?? null,
      notes: input.notes ?? null,
      agent_id: input.agent_id,
    })
    await this.contactRepo.save(contact)
    return { id: contact.id }
  }
}
