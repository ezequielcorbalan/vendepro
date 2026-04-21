import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import { NotFoundError } from '../../../domain/errors/not-found'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { Actor } from '../../../domain/rules/landing-rules'

export class ToggleBlockVisibilityUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; blockId: string; visible: boolean }): Promise<void> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    const target = landing.blocks.find(b => b.id === input.blockId)
    if (!target) throw new NotFoundError('Block', input.blockId)
    if (target.type === 'lead-form' && input.visible === false) {
      throw new ValidationError('No se puede ocultar el bloque lead-form (es requerido).')
    }
    const blocks = landing.blocks.map(b => b.id === input.blockId ? { ...b, visible: input.visible } : b)
    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
  }
}
