import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ReorderBlocksUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; orderedBlockIds: string[] }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)

    if (input.orderedBlockIds.length !== landing.blocks.length) {
      throw new ValidationError('El orden debe incluir todos los bloques existentes (misma longitud).')
    }
    const byId = new Map(landing.blocks.map(b => [b.id, b]))
    const reordered = input.orderedBlockIds.map(id => {
      const b = byId.get(id)
      if (!b) throw new ValidationError(`ID de bloque desconocido en el orden: ${id}`)
      return b
    })
    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks: reordered })
  }
}
