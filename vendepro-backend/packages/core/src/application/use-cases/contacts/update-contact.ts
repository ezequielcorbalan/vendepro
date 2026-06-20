import type { ContactRepository } from '../../ports/repositories/contact-repository'
import { Contact } from '../../../domain/entities/contact'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdateContactInput {
  full_name?: string
  phone?: string | null
  email?: string | null
  contact_type?: string | null
  neighborhood?: string | null
  notes?: string | null
}

export class UpdateContactUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(id: string, orgId: string, patch: UpdateContactInput): Promise<void> {
    const existing = await this.contactRepo.findById(id, orgId)
    if (!existing) throw new NotFoundError('Contacto no encontrado')

    const props = existing.toObject()
    const updated = Contact.create({
      ...props,
      full_name: patch.full_name ?? props.full_name,
      phone: patch.phone !== undefined ? patch.phone : props.phone,
      email: patch.email !== undefined ? patch.email : props.email,
      contact_type: patch.contact_type ?? props.contact_type,
      neighborhood: patch.neighborhood !== undefined ? patch.neighborhood : props.neighborhood,
      notes: patch.notes !== undefined ? patch.notes : props.notes,
    })
    await this.contactRepo.save(updated)
  }
}
