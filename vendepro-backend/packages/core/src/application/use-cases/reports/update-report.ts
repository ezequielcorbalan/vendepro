import type { ReportRepository, NewReportMetric, NewReportContent } from '../../ports/repositories/report-repository'
import type { IdGenerator } from '../../ports/id-generator'

export interface UpdateReportInput {
  id: string
  orgId: string
  userId: string
  userRole: string
  periodLabel?: string
  periodStart?: string
  periodEnd?: string
  publish?: boolean
  metrics?: Array<{
    source?: string
    impressions?: number | null
    portal_visits?: number | null
    inquiries?: number | null
    phone_calls?: number | null
    whatsapp?: number | null
    in_person_visits?: number | null
    offers?: number | null
    ranking_position?: number | null
    avg_market_price?: number | null
  }>
  strategy?: string
  marketing?: string
  conclusion?: string
  priceReference?: string
}

export class UpdateReportUseCase {
  constructor(
    private readonly repo: ReportRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: UpdateReportInput): Promise<{ success: boolean; id: string; propertyId: string }> {
    const report = await this.repo.findReportRaw(input.id)
    if (!report) {
      const err = new Error('Reporte no encontrado')
      ;(err as any).statusCode = 404
      throw err
    }

    // Permission check
    if (input.userRole !== 'admin' && report.created_by !== input.userId) {
      const err = new Error('Sin permisos')
      ;(err as any).statusCode = 403
      throw err
    }

    const status = input.publish ? 'published' : 'draft'
    const publishedAt = input.publish ? new Date().toISOString() : null

    // Update core report via save (upsert)
    const { Report } = await import('../../../domain/entities/report')
    const updatedReport = Report.create({
      id: report.id as string,
      property_id: report.property_id as string,
      period_label: input.periodLabel ?? (report.period_label as string),
      period_start: input.periodStart ?? (report.period_start as string),
      period_end: input.periodEnd ?? (report.period_end as string),
      status: status as 'draft' | 'published',
      created_by: report.created_by as string,
      created_at: report.created_at as string,
      published_at: publishedAt ?? (report.published_at as string | null),
    })
    await this.repo.save(updatedReport)

    if (Array.isArray(input.metrics)) {
      const metrics: NewReportMetric[] = input.metrics.map((m) => ({
        id: this.idGen.generate(),
        report_id: input.id,
        source: m.source || 'zonaprop',
        impressions: m.impressions ? Number(m.impressions) : null,
        portal_visits: m.portal_visits ? Number(m.portal_visits) : null,
        inquiries: m.inquiries ? Number(m.inquiries) : null,
        phone_calls: m.phone_calls ? Number(m.phone_calls) : null,
        whatsapp: m.whatsapp ? Number(m.whatsapp) : null,
        in_person_visits: m.in_person_visits ? Number(m.in_person_visits) : null,
        offers: m.offers ? Number(m.offers) : null,
        ranking_position: m.ranking_position ? Number(m.ranking_position) : null,
        avg_market_price: m.avg_market_price ? Number(m.avg_market_price) : null,
      }))
      await this.repo.replaceMetrics(input.id, metrics)
    }

    const sections: Array<[string, string]> = [
      ['strategy', input.strategy || ''],
      ['marketing', input.marketing || ''],
      ['conclusion', input.conclusion || ''],
      ['price_reference', input.priceReference || ''],
    ]
    const content: NewReportContent[] = sections.map(([section, body]) => ({
      id: this.idGen.generate(),
      report_id: input.id,
      section,
      title: '',
      body,
      sort_order: 0,
    }))
    await this.repo.replaceContent(input.id, content)

    return { success: true, id: input.id, propertyId: report.property_id as string }
  }
}
