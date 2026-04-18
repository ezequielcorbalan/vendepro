import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { canEditLanding, VERSION_RETENTION_NON_PUBLISH, type Actor } from '../../../domain/rules/landing-rules'

export interface UpdateLandingBlocksInput {
  actor: Actor
  orgId: string
  landingId: string
  blocks: Block[]
  label?: 'manual-save' | 'auto-save'
}

export class UpdateLandingBlocksUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: UpdateLandingBlocksInput): Promise<{ versionId: string; versionNumber: number }> {
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (!canEditLanding(input.actor, { agent_id: landing.agent_id, status: landing.status })) {
      throw new UnauthorizedError('No tenés permisos para editar esta landing')
    }

    const updated = landing.replaceBlocks(input.blocks)
    await this.landings.save(updated)

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: updated.blocks,
      label: input.label ?? 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    await this.versions.pruneNonPublish(landing.id, VERSION_RETENTION_NON_PUBLISH)

    return { versionId: version.id, versionNumber: version.version_number }
  }
}
