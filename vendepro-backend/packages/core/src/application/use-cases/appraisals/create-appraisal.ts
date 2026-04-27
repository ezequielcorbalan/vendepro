import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { IdGenerator } from '../../ports/id-generator'
import {
  Appraisal,
  type AppraisalProposalBlock,
  type AppraisalMarketSituationBlock,
  type AppraisalWorkConditionsBlock,
} from '../../../domain/entities/appraisal'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface CreateAppraisalInput {
  org_id: string
  agent_id: string
  property_address: string
  neighborhood?: string
  city?: string
  property_type?: string
  covered_area?: number | null
  total_area?: number | null
  semi_area?: number | null
  weighted_area?: number | null
  strengths?: string | null
  weaknesses?: string | null
  opportunities?: string | null
  threats?: string | null
  publication_analysis?: string | null
  suggested_price?: number | null
  test_price?: number | null
  expected_close_price?: number | null
  usd_per_m2?: number | null
  lead_id?: string | null
  property_id?: string | null
  proposal?: AppraisalProposalBlock | null
  market_situation?: AppraisalMarketSituationBlock | null
  work_conditions?: AppraisalWorkConditionsBlock | null
  video_links?: string[] | null
  template_id?: string | null
}

export class CreateAppraisalUseCase {
  constructor(
    private readonly repo: AppraisalRepository,
    private readonly idGen: IdGenerator,
    private readonly templateRepo?: AppraisalTemplateRepository,
  ) {}

  async execute(input: CreateAppraisalInput): Promise<{ id: string; status: string }> {
    const id = this.idGen.generate()

    let template_snapshot_json: unknown = null
    let template_synced_at: string | null = null
    if (input.template_id && this.templateRepo) {
      const tpl = await this.templateRepo.findById(input.template_id)
      if (!tpl) throw new ValidationError('Template no encontrado')
      if (tpl.org_id !== null && tpl.org_id !== input.org_id) throw new ValidationError('Template pertenece a otra org')
      template_snapshot_json = tpl.blocks
      template_synced_at = new Date().toISOString()
    }

    const appraisal = Appraisal.create({
      id,
      org_id: input.org_id,
      property_address: input.property_address,
      neighborhood: input.neighborhood ?? 'Sin barrio',
      city: input.city ?? 'Buenos Aires',
      property_type: input.property_type ?? 'departamento',
      covered_area: input.covered_area ?? null,
      total_area: input.total_area ?? null,
      semi_area: input.semi_area ?? null,
      weighted_area: input.weighted_area ?? null,
      strengths: input.strengths ?? null,
      weaknesses: input.weaknesses ?? null,
      opportunities: input.opportunities ?? null,
      threats: input.threats ?? null,
      publication_analysis: input.publication_analysis ?? null,
      suggested_price: input.suggested_price ?? null,
      test_price: input.test_price ?? null,
      expected_close_price: input.expected_close_price ?? null,
      usd_per_m2: input.usd_per_m2 ?? null,
      agent_id: input.agent_id,
      lead_id: input.lead_id ?? null,
      status: 'draft',
      public_slug: null,
      proposal: input.proposal ?? null,
      market_situation: input.market_situation ?? null,
      work_conditions: input.work_conditions ?? null,
      video_links: input.video_links ?? null,
      comparables: [],
      template_id: input.template_id ?? null,
      template_snapshot_json,
      template_synced_at,
      block_overrides_json: null,
    })
    await this.repo.save(appraisal)
    return { id, status: 'draft' }
  }
}
