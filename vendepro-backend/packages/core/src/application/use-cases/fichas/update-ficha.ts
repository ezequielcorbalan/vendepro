import type { FichaRepository } from '../../ports/repositories/ficha-repository'

export class UpdateFichaUseCase {
  constructor(private readonly repo: FichaRepository) {}

  async execute(id: string, orgId: string, patch: Record<string, unknown>): Promise<void> {
    const existing = await this.repo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Ficha not found')
      ;(err as any).statusCode = 404
      throw err
    }
    await this.repo.update(id, orgId, patch)
  }
}
