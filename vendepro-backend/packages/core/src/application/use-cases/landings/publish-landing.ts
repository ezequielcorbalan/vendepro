import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { LandingVersion } from '../../../domain/entities/landing-version'
import { NotFoundError } from '../../../domain/errors/not-found'
import { UnauthorizedError } from '../../../domain/errors/unauthorized'
import { ValidationError } from '../../../domain/errors/validation-error'
import { canPublish, type Actor } from '../../../domain/rules/landing-rules'

export class PublishLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { actor: Actor; orgId: string; landingId: string }): Promise<{ versionId: string }> {
    if (!canPublish(input.actor)) throw new UnauthorizedError('Solo admin puede publicar.')
    const landing = await this.landings.findById(input.landingId, input.orgId)
    if (!landing) throw new NotFoundError('Landing', input.landingId)
    if (landing.status !== 'pending_review' && landing.status !== 'draft') {
      throw new ValidationError(`No se puede publicar desde status "${landing.status}".`)
    }

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: landing.blocks,
      label: 'publish',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    const ready = landing.status === 'draft' ? landing.transitionStatus('pending_review') : landing
    const published = ready.markPublished({ version_id: version.id, published_by: input.actor.userId })
    await this.landings.save(published)

    return { versionId: version.id }
  }
}
