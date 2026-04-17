import type { ReportRepository, NewReportMetric, NewReportContent } from '../../ports/repositories/report-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Report } from '../../../domain/entities/report'

export interface CreateReportInput {
  propertyId: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  publish?: boolean
  createdBy: string
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
  competitors?: Array<{ url: string; address?: string | null; price?: number | null; notes?: string | null }>
}

export class CreateReportUseCase {
  constructor(
    private readonly repo: ReportRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: CreateReportInput): Promise<{ reportId: string; propertyId: string }> {
    const id = this.idGen.generate()
    const status = input.publish ? 'published' : 'draft'
    const publishedAt = input.publish ? new Date().toISOString() : null

    const report = Report.create({
      id,
      property_id: input.propertyId,
      period_label: input.periodLabel,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: status as 'draft' | 'published',
      created_by: input.createdBy,
      published_at: publishedAt,
    })

    await this.repo.save(report)

    if (Array.isArray(input.metrics) && input.metrics.length > 0) {
      const metrics: NewReportMetric[] = input.metrics.map((m) => ({
        id: this.idGen.generate(),
        report_id: id,
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
      await this.repo.replaceMetrics(id, metrics)
    }

    const sections: Array<[string, string]> = [
      ['strategy', input.strategy || ''],
      ['marketing', input.marketing || ''],
      ['conclusion', input.conclusion || ''],
      ['price_reference', input.priceReference || ''],
    ]
    const content: NewReportContent[] = sections
      .filter(([, body]) => body)
      .map(([section, body]) => ({
        id: this.idGen.generate(),
        report_id: id,
        section,
        title: '',
        body,
        sort_order: 0,
      }))
    if (content.length > 0) {
      await this.repo.replaceContent(id, content)
    }

    if (Array.isArray(input.competitors) && input.competitors.length > 0) {
      await this.repo.deleteCompetitorLinks(input.propertyId)
      for (const comp of input.competitors) {
        await this.repo.addCompetitorLink({
          id: this.idGen.generate(),
          property_id: input.propertyId,
          url: comp.url,
          address: comp.address ?? null,
          price: comp.price ? Number(comp.price) : null,
          notes: comp.notes ?? null,
        })
      }
    }

    return { reportId: id, propertyId: input.propertyId }
  }
}
