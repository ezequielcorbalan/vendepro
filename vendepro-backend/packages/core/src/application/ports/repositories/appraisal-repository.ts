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
}
