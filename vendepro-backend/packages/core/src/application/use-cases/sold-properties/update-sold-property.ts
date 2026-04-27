import type { SoldPropertyRepository } from '../../ports/repositories/sold-property-repository'
import type { SoldPropertyProps } from '../../../domain/entities/sold-property'
import { NotFoundError } from '../../../domain/errors/not-found'

export type UpdateSoldPropertyPatch = Partial<Omit<SoldPropertyProps, 'id' | 'org_id' | 'created_at' | 'created_by'>>

export class UpdateSoldPropertyUseCase {
  constructor(private readonly repo: SoldPropertyRepository) {}

  async execute(id: string, orgId: string, patch: UpdateSoldPropertyPatch): Promise<void> {
    const sp = await this.repo.findById(id, orgId)
    if (!sp) throw new NotFoundError('SoldProperty', id)
    sp.update(patch)
    await this.repo.save(sp)
  }
}
