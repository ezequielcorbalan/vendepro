import type { PropertyRepository } from '../../ports/repositories/property-repository'

export class UpdatePropertyUseCase {
  constructor(private readonly propRepo: PropertyRepository) {}

  async execute(id: string, orgId: string, patch: Record<string, unknown>): Promise<void> {
    const existing = await this.propRepo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Property not found')
      ;(err as any).statusCode = 404
      throw err
    }
    await this.propRepo.update(id, orgId, patch)
  }
}
