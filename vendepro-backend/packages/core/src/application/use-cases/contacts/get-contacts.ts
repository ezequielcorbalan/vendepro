import type { ContactRepository, ContactFilters } from '../../ports/repositories/contact-repository'
import type { TagRepository } from '../../ports/repositories/tag-repository'
import type { ContactProps } from '../../../domain/entities/contact'

export interface ContactListItem extends ContactProps {
  tags?: Array<{ id: string; name: string; color: string | null }>
}

export class GetContactsUseCase {
  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly tagRepo?: TagRepository,
  ) {}

  /**
   * Devuelve los contactos como objetos planos. Si hay tagRepo,
   * cada contacto incluye `tags` (los tags de sus leads).
   */
  async execute(orgId: string, filters?: ContactFilters): Promise<ContactListItem[]> {
    const contacts = await this.contactRepo.findByOrg(orgId, filters)
    const plain: ContactListItem[] = contacts.map(c => c.toObject())
    if (!this.tagRepo || plain.length === 0) return plain

    const tagsByContact = await this.tagRepo.findByContactIds(plain.map(c => c.id), orgId)
    return plain.map(c => ({ ...c, tags: tagsByContact[c.id] ?? [] }))
  }
}
