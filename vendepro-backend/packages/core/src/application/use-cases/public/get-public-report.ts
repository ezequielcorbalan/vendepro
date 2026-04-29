import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { PropertyVisitFormRepository } from '../../ports/repositories/property-visit-form-repository'
import type {
  ReportMetricProps,
  ReportContentProps,
} from '../../../domain/entities/report'

export interface PublicReportPayload {
  property: {
    id: string
    address: string
    neighborhood: string | null
    city: string | null
    cover_photo: string | null
    asking_price: number | null
    currency: string | null
    property_type: string | null
    rooms: number | null
    size_m2: number | null
  }
  org: {
    id: string
    name: string
    logo_url: string | null
    brand_color: string | null
  }
  report: {
    id: string
    period_label: string
    period_start: string
    period_end: string
    status: string
    public_slug: string | null
    published_at: string | null
  }
  metrics: ReportMetricProps[]
  content: ReportContentProps[]
  photos: Array<{ id: string; photo_url: string; r2_key?: string }>
  visit_forms: Array<{
    id: string
    visitor_name: string | null
    rating: number | null
    liked: string | null
    disliked: string | null
    buy_intention: string | null
    source: string | null
    situation: string | null
    observations: string | null
    submitted_at: string
  }>
  available_reports: Array<{
    slug: string
    period_label: string
    period_start: string
    period_end: string
    is_current: boolean
  }>
  competitors: Array<{
    id: string
    url: string
    address: string | null
    price: number | null
    notes: string | null
  }>
}

export class GetPublicReportUseCase {
  constructor(
    private readonly propertyRepo: PropertyRepository,
    private readonly reportRepo: ReportRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly visitFormRepo: PropertyVisitFormRepository,
  ) {}

  async execute(slug: string): Promise<PublicReportPayload | null> {
    const found = await this.reportRepo.findPublicBySlug(slug)
    if (!found) return null

    const property = await this.propertyRepo.findById(found.propertyId, found.orgId)
    if (!property) return null

    const [org, metrics, content, photos, visitForms, allReports, competitorRows] = await Promise.all([
      this.orgRepo.findById(found.orgId),
      this.reportRepo.findMetrics(found.report.id, found.orgId),
      this.reportRepo.findContent(found.report.id, found.orgId),
      this.reportRepo.findPhotosByReport(found.report.id, found.orgId),
      this.visitFormRepo.listByProperty(found.propertyId, found.orgId),
      this.reportRepo.findByOrg(found.orgId, found.propertyId),
      this.reportRepo.findCompetitorLinks(found.propertyId, found.orgId),
    ])

    if (!org) return null

    const p = property.toObject()
    const r = found.report.toObject()

    const submittedVisitForms = visitForms
      .filter((f) => f.submitted_at !== null && f.archived_at === null && f.deleted_at === null)
      .map((f) => {
        const o = f.toObject()
        return {
          id: o.id,
          visitor_name: o.visitor_name,
          rating: o.rating,
          liked: o.liked,
          disliked: o.disliked,
          buy_intention: o.buy_intention,
          source: o.source,
          situation: o.situation,
          observations: o.observations,
          submitted_at: o.submitted_at as string,
        }
      })

    const availableReports = allReports
      .filter((r) => r.status === 'published' && r.public_slug)
      .sort((a, b) => (b.period_start ?? '').localeCompare(a.period_start ?? ''))
      .map((r) => ({
        slug: r.public_slug as string,
        period_label: r.period_label,
        period_start: r.period_start,
        period_end: r.period_end,
        is_current: r.public_slug === slug,
      }))

    return {
      property: {
        id: p.id,
        address: p.address,
        neighborhood: p.neighborhood ?? null,
        city: p.city ?? null,
        cover_photo: p.cover_photo ?? null,
        asking_price: p.asking_price ?? null,
        currency: p.currency ?? null,
        property_type: p.property_type ?? null,
        rooms: p.rooms ?? null,
        size_m2: p.size_m2 ?? null,
      },
      org: {
        id: org.id,
        name: org.name,
        logo_url: org.logo_url ?? null,
        brand_color: org.brand_color ?? null,
      },
      report: {
        id: r.id,
        period_label: r.period_label,
        period_start: r.period_start,
        period_end: r.period_end,
        status: r.status,
        public_slug: r.public_slug ?? null,
        published_at: r.published_at ?? null,
      },
      metrics,
      content,
      photos,
      visit_forms: submittedVisitForms,
      available_reports: availableReports,
      competitors: (competitorRows ?? []).map((c: any) => ({
        id: String(c.id),
        url: String(c.url),
        address: c.address ?? null,
        price: c.price != null ? Number(c.price) : null,
        notes: c.notes ?? null,
      })),
    }
  }
}
