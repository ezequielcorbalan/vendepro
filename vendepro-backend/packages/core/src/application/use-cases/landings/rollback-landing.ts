import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canRollback, type Actor } from '../../../domain/rules/landing-rules'

export class RollbackLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string; versionId: string }): Promise<{ versionNumber: number }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (!canRollback(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No podés hacer rollback de esta landing.')
    }
    const target = await this.versions.findById(input.versionId)
    if (!target || target.landing_id !== landing.id) {
      throw new NotFoundError('Version', input.versionId)
    }
    const updated = landing.replaceBlocks(target.blocks)
    await this.landings.save(updated)

    const nextNum = await this.versions.nextVersionNumber(landing.id)
    const newVersion = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: nextNum,
      blocks: updated.blocks,
      label: 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(newVersion)
    return { versionNumber: newVersion.version_number }
  }
}
