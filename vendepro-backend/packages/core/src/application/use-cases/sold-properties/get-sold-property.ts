import type { SoldPropertyRepository } from '../../ports/repositories/sold-property-repository'
import type { SoldProperty } from '../../../domain/entities/sold-property'
import { NotFoundError } from '../../../domain/errors/not-found'

export class GetSoldPropertyUseCase {
  constructor(private readonly repo: SoldPropertyRepository) {}

  async execute(id: string, orgId: string): Promise<SoldProperty> {
    const sp = await this.repo.findById(id, orgId)
    if (!sp) throw new NotFoundError('SoldProperty', id)
    return sp
  }
}
