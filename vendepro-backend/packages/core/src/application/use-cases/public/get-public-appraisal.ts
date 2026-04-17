import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { TemplateBlockRepository } from '../../ports/repositories/template-block-repository'
import type { Appraisal } from '../../../domain/entities/appraisal'
import type { TemplateBlock } from '../../../domain/entities/template-block'

export interface GetPublicAppraisalResult {
  appraisal: Appraisal
  org: { name: string; logo_url: string | null; brand_color: string | null }
  blocks: TemplateBlock[]
}

export class GetPublicAppraisalUseCase {
  constructor(
    private readonly appraisalRepo: AppraisalRepository,
    private readonly templateBlockRepo: TemplateBlockRepository,
  ) {}

  async execute(idOrSlug: string): Promise<GetPublicAppraisalResult | null> {
    const result = await this.appraisalRepo.findPublicByIdOrSlugWithOrg(idOrSlug)
    if (!result) return null

    const blocks = await this.templateBlockRepo.findEnabledByOrg(result.appraisal.org_id)

    return {
      appraisal: result.appraisal,
      org: result.org,
      blocks,
    }
  }
}
