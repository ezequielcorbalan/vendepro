import type { Report, ReportMetricProps, ReportContentProps } from '../../../domain/entities/report'

export interface NewReportMetric {
  id: string
  report_id: string
  source: string
  impressions: number | null
  portal_visits: number | null
  inquiries: number | null
  phone_calls: number | null
  whatsapp: number | null
  in_person_visits: number | null
  offers: number | null
  ranking_position: number | null
  avg_market_price: number | null
}

export interface NewReportContent {
  id: string
  report_id: string
  section: string
  title: string
  body: string
  sort_order: number
}

export interface ReportRepository {
  findById(id: string, orgId: string): Promise<Report | null>
  findByOrg(orgId: string, propertyId?: string): Promise<Report[]>
  findByProperty(propertyId: string, orgId: string): Promise<Report[]>
  findPublicBySlug(slug: string): Promise<{ report: Report; propertyId: string; orgId: string } | null>
  findLatestPublishedByProperty(propertyId: string): Promise<Report | null>
  save(report: Report): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  findMetrics(reportId: string, orgId: string): Promise<ReportMetricProps[]>
  findContent(reportId: string, orgId: string): Promise<ReportContentProps[]>
  replaceMetrics(reportId: string, orgId: string, metrics: NewReportMetric[]): Promise<void>
  replaceContent(reportId: string, orgId: string, content: NewReportContent[]): Promise<void>
  findReportRaw(id: string, orgId: string): Promise<Record<string, unknown> | null>
  deleteCompetitorLinks(propertyId: string, orgId: string): Promise<void>
  addCompetitorLink(link: { id: string; property_id: string; url: string; address: string | null; price: number | null; notes: string | null }, orgId: string): Promise<void>
  findCompetitorLinks(propertyId: string, orgId: string): Promise<Record<string, unknown>[]>
  findPhotosByReport(reportId: string, orgId: string): Promise<Array<{ id: string; photo_url: string; r2_key?: string }>>
}
