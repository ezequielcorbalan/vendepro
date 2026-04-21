import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { Block } from '../../../domain/value-objects/block-schemas'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface PublicLandingView {
  id: string
  full_slug: string
  kind: 'lead_capture' | 'property'
  blocks: Block[]
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_at: string
}

export class GetPublicLandingUseCase {
  constructor(
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
  ) {}

  async execute(input: { fullSlug: string }): Promise<PublicLandingView> {
    const landing = await this.landings.findByFullSlug(input.fullSlug)
    if (!landing) throw new NotFoundError('Landing', input.fullSlug)
    if (landing.status !== 'published' || !landing.published_version_id || !landing.published_at) {
      throw new NotFoundError('Landing', input.fullSlug)
    }
    const version = await this.versions.findById(landing.published_version_id)
    if (!version) throw new NotFoundError('Version', landing.published_version_id)

    return {
      id: landing.id,
      full_slug: landing.full_slug,
      kind: landing.kind,
      blocks: version.blocks.filter(b => b.visible),
      seo_title: landing.seo_title,
      seo_description: landing.seo_description,
      og_image_url: landing.og_image_url,
      published_at: landing.published_at,
    }
  }
}
