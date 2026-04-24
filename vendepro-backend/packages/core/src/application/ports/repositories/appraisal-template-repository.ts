import type { AppraisalTemplate, AppraisalTemplateKind } from '../../../domain/entities/appraisal-template'

export interface AppraisalTemplateRepository {
  findById(id: string): Promise<AppraisalTemplate | null>
  listVisibleTo(orgId: string, filters?: { kind?: AppraisalTemplateKind; onlyActive?: boolean }): Promise<AppraisalTemplate[]>
  save(template: AppraisalTemplate): Promise<void>
  countUsingTemplate(templateId: string): Promise<number>
}
