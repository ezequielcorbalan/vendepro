import type { ContactRepository, ContactFilters } from '../../ports/repositories/contact-repository'
import type { TagRepository } from '../../ports/repositories/tag-repository'
import type { ContactProps } from '../../../domain/entities/contact'

export interface ContactListItem extends ContactProps {
  tags?: Array<{ id: string; name: string; color: string | null }>
  /** Dirección de la propiedad por la que ingresó el contacto (lead más reciente) */
  property_address?: string | null
}

export class GetContactsUseCase {
  constructor(
    private readonly contactRepo: ContactRepository,
    private readonly tagRepo?: TagRepository,
  ) {}

  /**
   * Devuelve los contactos como objetos planos, enriquecidos con:
   * - `tags`: los tags de sus leads (si hay tagRepo)
   * - `property_address`: la dirección del lead más reciente del contacto
   */
  async execute(orgId: string, filters?: ContactFilters): Promise<ContactListItem[]> {
    const contacts = await this.contactRepo.findByOrg(orgId, filters)
    const plain: ContactListItem[] = contacts.map(c => c.toObject())
    if (plain.length === 0) return plain

    const ids = plain.map(c => c.id)
    const [tagsByContact, addressByContact] = await Promise.all([
      this.tagRepo ? this.tagRepo.findByContactIds(ids, orgId) : Promise.resolve({}),
      this.contactRepo.findLeadPropertyByContactIds(ids, orgId),
    ])

    return plain.map(c => ({
      ...c,
      tags: tagsByContact[c.id] ?? [],
      property_address: addressByContact[c.id] ?? null,
    }))
  }
}
