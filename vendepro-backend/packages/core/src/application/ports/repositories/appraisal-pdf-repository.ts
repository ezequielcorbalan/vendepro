import type { AppraisalPdf } from '../../../domain/entities/appraisal-pdf'

export interface AppraisalPdfRepository {
  findById(id: string): Promise<AppraisalPdf | null>
  findCachedByHash(contentHash: string, now: Date): Promise<AppraisalPdf | null>
  save(pdf: AppraisalPdf): Promise<void>
  countByOrgSince(orgId: string, sinceIso: string): Promise<number>
  deleteExpired(now: Date): Promise<number>
}
