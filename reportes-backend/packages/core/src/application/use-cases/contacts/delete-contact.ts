import type { ContactRepository } from '../../ports/repositories/contact-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export class DeleteContactUseCase {
  constructor(private readonly contactRepo: ContactRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    const contact = await this.contactRepo.findById(id, orgId)
    if (!contact) throw new NotFoundError('Contacto no encontrado')
    await this.contactRepo.delete(id, orgId)
  }
}
