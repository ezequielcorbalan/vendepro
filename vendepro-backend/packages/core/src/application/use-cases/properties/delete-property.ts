import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class DeletePropertyUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    await this.propRepo.delete(id, orgId)
  }
}
