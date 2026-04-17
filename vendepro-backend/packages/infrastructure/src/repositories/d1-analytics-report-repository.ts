import type {
  AnalyticsReportRepository,
  NeighborhoodPerformanceRow,
  PaginatedReports,
  PerformanceTotals,
  ReportsListFilters,
  TimelinePointRow,
} from '@vendepro/core'

export class D1AnalyticsReportRepository implements AnalyticsReportRepository {
  constructor(private readonly db: D1Database) {}

  async getPerformanceTotals(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<PerformanceTotals> {
    const sourceFilter = source ? ' AND rm.source = ?' : ''
    const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

    const row = await this.db.prepare(`
      SELECT
        COUNT(DISTINCT r.id) AS reports_published,
        COALESCE(SUM(rm.impressions), 0) AS total_impressions,
        COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
        COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits,
        COALESCE(SUM(rm.offers), 0) AS total_offers
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE p.org_id = ?
        AND r.status = 'published'
        AND date(r.published_at) >= ?
        AND date(r.published_at) <= ?
        ${sourceFilter}
    `).bind(...binds).first() as any

    return {
      reports_published: Number(row?.reports_published ?? 0),
      total_impressions: Number(row?.total_impressions ?? 0),
      total_portal_visits: Number(row?.total_portal_visits ?? 0),
      total_in_person_visits: Number(row?.total_in_person_visits ?? 0),
      total_offers: Number(row?.total_offers ?? 0),
    }
  }

  async getNeighborhoodPerformance(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<NeighborhoodPerformanceRow[]> {
    const sourceFilter = source ? ' AND rm.source = ?' : ''
    const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

    const res = await this.db.prepare(`
      SELECT
        p.neighborhood AS neighborhood,
        COUNT(DISTINCT r.id) AS reports_count,
        COALESCE(ROUND(AVG(rm.impressions)), 0) AS avg_impressions,
        COALESCE(ROUND(AVG(rm.portal_visits)), 0) AS avg_portal_visits,
        COALESCE(ROUND(AVG(rm.in_person_visits)), 0) AS avg_in_person_visits,
        COALESCE(ROUND(AVG(rm.offers) * 100) / 100.0, 0) AS avg_offers,
        COALESCE(SUM(rm.offers), 0) AS total_offers
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE p.org_id = ?
        AND r.status = 'published'
        AND date(r.published_at) >= ?
        AND date(r.published_at) <= ?
        ${sourceFilter}
      GROUP BY p.neighborhood
      ORDER BY reports_count DESC, p.neighborhood ASC
    `).bind(...binds).all()

    return ((res.results as any[]) ?? []).map(r => ({
      neighborhood: r.neighborhood ?? 'Sin barrio',
      reports_count: Number(r.reports_count ?? 0),
      avg_impressions: Number(r.avg_impressions ?? 0),
      avg_portal_visits: Number(r.avg_portal_visits ?? 0),
      avg_in_person_visits: Number(r.avg_in_person_visits ?? 0),
      avg_offers: Number(r.avg_offers ?? 0),
      total_offers: Number(r.total_offers ?? 0),
    }))
  }

  async getTimelinePerformance(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<TimelinePointRow[]> {
    const sourceFilter = source ? ' AND rm.source = ?' : ''
    const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

    const res = await this.db.prepare(`
      SELECT
        strftime('%Y-%m', r.published_at) AS month_key,
        COALESCE(SUM(rm.impressions), 0) AS impressions,
        COALESCE(SUM(rm.portal_visits), 0) AS portal_visits,
        COALESCE(SUM(rm.in_person_visits), 0) AS in_person_visits,
        COALESCE(SUM(rm.offers), 0) AS offers
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE p.org_id = ?
        AND r.status = 'published'
        AND date(r.published_at) >= ?
        AND date(r.published_at) <= ?
        ${sourceFilter}
      GROUP BY month_key
      ORDER BY month_key ASC
    `).bind(...binds).all()

    return ((res.results as any[]) ?? []).map(r => ({
      month_key: String(r.month_key ?? ''),
      impressions: Number(r.impressions ?? 0),
      portal_visits: Number(r.portal_visits ?? 0),
      in_person_visits: Number(r.in_person_visits ?? 0),
      offers: Number(r.offers ?? 0),
    }))
  }

  async listReportsWithMetrics(
    orgId: string,
    filters: ReportsListFilters,
  ): Promise<PaginatedReports> {
    const page = Math.max(1, filters.page)
    const pageSize = Math.min(Math.max(1, filters.page_size), 100)
    const offset = (page - 1) * pageSize

    const whereParts: string[] = ['p.org_id = ?']
    const whereBinds: unknown[] = [orgId]

    if (filters.neighborhood) {
      whereParts.push('p.neighborhood = ?')
      whereBinds.push(filters.neighborhood)
    }
    if (filters.status) {
      whereParts.push('r.status = ?')
      whereBinds.push(filters.status)
    }
    if (filters.property_id) {
      whereParts.push('r.property_id = ?')
      whereBinds.push(filters.property_id)
    }
    if (filters.from) {
      whereParts.push('date(r.period_start) >= ?')
      whereBinds.push(filters.from)
    }
    if (filters.to) {
      whereParts.push('date(r.period_end) <= ?')
      whereBinds.push(filters.to)
    }

    const whereSql = whereParts.join(' AND ')

    const totalRow = await this.db.prepare(`
      SELECT COUNT(DISTINCT r.id) AS total
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      WHERE ${whereSql}
    `).bind(...whereBinds).first() as any
    const total = Number(totalRow?.total ?? 0)

    const res = await this.db.prepare(`
      SELECT
        r.id,
        r.property_id,
        p.address AS property_address,
        p.neighborhood AS property_neighborhood,
        r.period_label,
        r.period_start,
        r.period_end,
        r.status,
        r.published_at,
        COALESCE(SUM(rm.impressions), 0) AS impressions,
        COALESCE(SUM(rm.portal_visits), 0) AS portal_visits,
        COALESCE(SUM(rm.in_person_visits), 0) AS in_person_visits,
        COALESCE(SUM(rm.offers), 0) AS offers
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE ${whereSql}
      GROUP BY r.id
      ORDER BY COALESCE(r.published_at, r.period_end) DESC
      LIMIT ? OFFSET ?
    `).bind(...whereBinds, pageSize, offset).all()

    const results = ((res.results as any[]) ?? []).map(row => ({
      id: String(row.id),
      property_id: String(row.property_id),
      property_address: String(row.property_address ?? ''),
      property_neighborhood: String(row.property_neighborhood ?? 'Sin barrio'),
      period_label: String(row.period_label ?? ''),
      period_start: String(row.period_start ?? ''),
      period_end: String(row.period_end ?? ''),
      status: String(row.status ?? ''),
      published_at: row.published_at ? String(row.published_at) : null,
      impressions: Number(row.impressions ?? 0),
      portal_visits: Number(row.portal_visits ?? 0),
      in_person_visits: Number(row.in_person_visits ?? 0),
      offers: Number(row.offers ?? 0),
    }))

    return { total, results }
  }
}
