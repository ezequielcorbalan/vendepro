import type { FichaTasacion } from '../../../domain/entities/ficha-tasacion'

export interface FichaRepository {
  findById(id: string, orgId: string): Promise<FichaTasacion | null>
  findByAppraisal(appraisalId: string, orgId: string): Promise<FichaTasacion[]>
  findPublicBySlug(slug: string): Promise<FichaTasacion | null>
  save(ficha: FichaTasacion): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
