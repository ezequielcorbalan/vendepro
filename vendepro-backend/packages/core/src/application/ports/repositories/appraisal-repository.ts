import type { Appraisal, AppraisalComparableProps } from '../../../domain/entities/appraisal'

export interface AppraisalFilters {
  stage?: string
  agent_id?: string
}

export interface AppraisalPublicResult {
  appraisal: Appraisal
  org: { name: string; logo_url: string | null; brand_color: string | null }
}

export interface NewAppraisalComparable {
  id: string
  appraisal_id: string
  zonaprop_url: string | null
  address: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  sort_order: number
}

export interface AppraisalRepository {
  findById(id: string, orgId: string): Promise<Appraisal | null>
  findBySlug(slug: string): Promise<Appraisal | null>
  findPublicByIdOrSlugWithOrg(idOrSlug: string): Promise<AppraisalPublicResult | null>
  findByOrg(orgId: string, filters?: AppraisalFilters): Promise<Appraisal[]>
  save(appraisal: Appraisal): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  countByOrg(orgId: string): Promise<number>
  /**
   * Counts appraisals by org and a stage/status value.
   * Note: the appraisals table uses `status` with values ('draft','generated','sent') per the schema.
   * The legacy dashboard queried `stage = 'captado'` which does not exist as a column.
   * The use-case wraps this in a try/catch and returns 0 on error to preserve original fallback behavior.
   */
  countByOrgAndStage(orgId: string, stage: string): Promise<number>
  countByAgent(orgId: string, agentId: string): Promise<number>
  findComparables(appraisalId: string): Promise<AppraisalComparableProps[]>
  addComparable(comparable: NewAppraisalComparable): Promise<void>
  removeComparable(comparableId: string): Promise<void>
  update(id: string, orgId: string, patch: Record<string, unknown>): Promise<void>
}
