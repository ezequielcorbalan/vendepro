import type { FichaRepository } from '../../ports/repositories/ficha-repository'

export class DeleteFichaUseCase {
  constructor(private readonly repo: FichaRepository) {}

  async execute(id: string, orgId: string): Promise<void> {
    const existing = await this.repo.findById(id, orgId)
    if (!existing) {
      const err = new Error('Ficha not found')
      ;(err as any).statusCode = 404
      throw err
    }
    await this.repo.delete(id, orgId)
  }
}
