import type { ContactRepository, ContactFilters } from '../../ports/repositories/contact-repository'
import type { Contact } from '../../../domain/entities/contact'

export class GetContactsUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(orgId: string, filters?: ContactFilters): Promise<Contact[]> {
    return this.contactRepo.findByOrg(orgId, filters)
  }
}
