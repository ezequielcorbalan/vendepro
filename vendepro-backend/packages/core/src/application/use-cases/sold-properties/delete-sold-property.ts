import type { SoldPropertyRepository } from '../../ports/repositories/sold-property-repository'

export class DeleteSoldPropertyUseCase {
  constructor(private readonly repo: SoldPropertyRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.repo.delete(id, orgId)
  }
}
