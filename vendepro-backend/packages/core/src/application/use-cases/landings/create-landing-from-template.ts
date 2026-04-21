import { Landing, type LandingKind, type LeadRules } from '../../../domain/entities/landing'
import { LandingVersion } from '../../../domain/entities/landing-version'
import type { LandingRepository } from '../../ports/repositories/landing-repository'
import type { LandingTemplateRepository } from '../../ports/repositories/landing-template-repository'
import type { LandingVersionRepository } from '../../ports/repositories/landing-version-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { generateSlugSuffix } from '../../../domain/value-objects/landing-slug'
import { NotFoundError } from '../../../domain/errors/not-found'
import type { Actor } from '../../../domain/rules/landing-rules'

export interface CreateLandingInput {
  actor: Actor
  orgId: string
  templateId: string
  slugBase: string
  brandVoice?: string | null
  leadRules?: LeadRules | null
  seoTitle?: string | null
  seoDescription?: string | null
  ogImageUrl?: string | null
}

export interface CreateLandingOutput {
  landingId: string
  fullSlug: string
}

const MAX_SLUG_COLLISION_RETRIES = 5

export class CreateLandingFromTemplateUseCase {
  constructor(
    private readonly templates: LandingTemplateRepository,
    private readonly landings: LandingRepository,
    private readonly versions: LandingVersionRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateLandingInput): Promise<CreateLandingOutput> {
    const template = await this.templates.findById(input.templateId)
    if (!template) throw new NotFoundError('Template', input.templateId)
    if (template.org_id !== null && template.org_id !== input.orgId) {
      throw new NotFoundError('Template', input.templateId)
    }

    let slugSuffix = generateSlugSuffix()
    let fullSlug = `${input.slugBase}-${slugSuffix}`
    let attempts = 0
    while (await this.landings.existsFullSlug(fullSlug)) {
      if (++attempts > MAX_SLUG_COLLISION_RETRIES) {
        throw new Error('No se pudo generar un slug único tras varios intentos. Probá con otro slug_base.')
      }
      slugSuffix = generateSlugSuffix()
      fullSlug = `${input.slugBase}-${slugSuffix}`
    }

    const landing = Landing.create({
      id: this.idGen.generate(),
      org_id: input.orgId,
      agent_id: input.actor.userId,
      template_id: template.id,
      kind: template.kind as LandingKind,
      slug_base: input.slugBase,
      slug_suffix: slugSuffix,
      blocks: template.blocks.map(b => ({ ...b, data: structuredClone(b.data) })),
      brand_voice: input.brandVoice ?? null,
      lead_rules: input.leadRules ?? null,
      seo_title: input.seoTitle ?? null,
      seo_description: input.seoDescription ?? null,
      og_image_url: input.ogImageUrl ?? null,
    })

    await this.landings.save(landing)

    const versionNumber = await this.versions.nextVersionNumber(landing.id)
    const version = LandingVersion.create({
      id: this.idGen.generate(),
      landing_id: landing.id,
      version_number: versionNumber,
      blocks: landing.blocks,
      label: 'manual-save',
      created_by: input.actor.userId,
    })
    await this.versions.save(version)

    return { landingId: landing.id, fullSlug: landing.full_slug }
  }
}
