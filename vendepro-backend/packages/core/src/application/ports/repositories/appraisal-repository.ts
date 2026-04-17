import type { Appraisal } from '../../../domain/entities/appraisal'

export interface AppraisalFilters {
  stage?: string
  agent_id?: string
}

export interface AppraisalRepository {
  findById(id: string, orgId: string): Promise<Appraisal | null>
  findBySlug(slug: string): Promise<Appraisal | null>
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
}
