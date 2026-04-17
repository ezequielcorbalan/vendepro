import type { Report } from '../../../domain/entities/report'

export interface ReportRepository {
  findById(id: string, orgId: string): Promise<Report | null>
  findByProperty(propertyId: string, orgId: string): Promise<Report[]>
  findPublicBySlug(slug: string): Promise<Report | null>
  findLatestPublishedByProperty(propertyId: string): Promise<Report | null>
  save(report: Report): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
