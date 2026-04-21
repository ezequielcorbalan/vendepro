import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { UpdateLandingBlocksUseCase } from './update-landing-blocks'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'
import type { Actor } from '../../../domain/rules/landing-rules'

export interface AddBlockInput {
  actor: Actor
  orgId: string
  landingId: string
  block: Omit<Block, 'id'>
  insertAtIndex?: number
}

export class AddBlockUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: AddBlockInput): Promise<{ blockId: string }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)

    const newBlock = { ...input.block, id: this.idGen.generate() } as Block
    const blocks = [...landing.blocks]
    const leadFormIdx = blocks.findIndex(b => b.type === 'lead-form')
    const idx = input.insertAtIndex ?? (leadFormIdx >= 0 ? leadFormIdx : blocks.length)
    blocks.splice(idx, 0, newBlock)

    const update = new UpdateLandingBlocksUseCase(this.landings, this.versions, this.idGen)
    await update.execute({ actor: input.actor, orgId: input.orgId, landingId: landing.id, blocks })
    return { blockId: newBlock.id }
  }
}
