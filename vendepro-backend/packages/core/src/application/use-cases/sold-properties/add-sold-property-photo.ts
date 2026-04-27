import type { SoldPropertyRepository } from '../../ports/repositories/sold-property-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export class AddSoldPropertyPhotoUseCase {
  constructor(private readonly repo: SoldPropertyRepository) {}

  async execute(id: string, orgId: string, photoUrl: string): Promise<void> {
    const sp = await this.repo.findById(id, orgId)
    if (!sp) throw new NotFoundError('SoldProperty', id)
    sp.addPhoto(photoUrl)
    await this.repo.save(sp)
  }
}
