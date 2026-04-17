import type {
  ActiveListingRaw,
  AnalyticsReportRepository,
  NeighborhoodGroupTotals,
  NeighborhoodPerformanceRow,
  NeighborhoodSoldBenchmark,
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

    // Queries separadas para evitar que el JOIN con report_metrics
    // multiplique el cálculo de días por cada fila de métricas.
    const [metricsRow, daysRow] = await Promise.all([
      this.db.prepare(`
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
      `).bind(...binds).first() as Promise<any>,
      this.db.prepare(`
        SELECT COALESCE(SUM(
          MAX(1, CAST(julianday(r.period_end) - julianday(r.period_start) AS INTEGER))
        ), 0) AS total_days
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        WHERE p.org_id = ?
          AND r.status = 'published'
          AND date(r.published_at) >= ?
          AND date(r.published_at) <= ?
      `).bind(orgId, start, end).first() as Promise<any>,
    ])

    return {
      reports_published: Number(metricsRow?.reports_published ?? 0),
      total_impressions: Number(metricsRow?.total_impressions ?? 0),
      total_portal_visits: Number(metricsRow?.total_portal_visits ?? 0),
      total_in_person_visits: Number(metricsRow?.total_in_person_visits ?? 0),
      total_offers: Number(metricsRow?.total_offers ?? 0),
      total_days: Number(daysRow?.total_days ?? 0),
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

    const [metricsRes, daysRes] = await Promise.all([
      this.db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COUNT(DISTINCT r.id) AS reports_count,
          COALESCE(ROUND(AVG(rm.impressions)), 0) AS avg_impressions,
          COALESCE(ROUND(AVG(rm.portal_visits)), 0) AS avg_portal_visits,
          COALESCE(ROUND(AVG(rm.in_person_visits)), 0) AS avg_in_person_visits,
          COALESCE(ROUND(AVG(rm.offers) * 100) / 100.0, 0) AS avg_offers,
          COALESCE(SUM(rm.offers), 0) AS total_offers,
          COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
          COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits
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
      `).bind(...binds).all(),
      this.db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COALESCE(SUM(
            MAX(1, CAST(julianday(r.period_end) - julianday(r.period_start) AS INTEGER))
          ), 0) AS total_days
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        WHERE p.org_id = ?
          AND r.status = 'published'
          AND date(r.published_at) >= ?
          AND date(r.published_at) <= ?
        GROUP BY p.neighborhood
      `).bind(orgId, start, end).all(),
    ])

    const daysMap = new Map<string, number>()
    for (const row of (daysRes.results as any[]) ?? []) {
      daysMap.set(String(row.neighborhood ?? ''), Number(row.total_days ?? 0))
    }

    return ((metricsRes.results as any[]) ?? []).map(r => ({
      neighborhood: r.neighborhood ?? 'Sin barrio',
      reports_count: Number(r.reports_count ?? 0),
      avg_impressions: Number(r.avg_impressions ?? 0),
      avg_portal_visits: Number(r.avg_portal_visits ?? 0),
      avg_in_person_visits: Number(r.avg_in_person_visits ?? 0),
      avg_offers: Number(r.avg_offers ?? 0),
      total_offers: Number(r.total_offers ?? 0),
      total_portal_visits: Number(r.total_portal_visits ?? 0),
      total_in_person_visits: Number(r.total_in_person_visits ?? 0),
      total_days: daysMap.get(String(r.neighborhood ?? '')) ?? 0,
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

  async getNeighborhoodTotalsByPropertyStatus(
    orgId: string,
    propertyStatus: 'sold' | 'active',
  ): Promise<NeighborhoodGroupTotals[]> {
    const [metricsRes, daysRes] = await Promise.all([
      this.db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COUNT(DISTINCT p.id) AS property_count,
          COUNT(DISTINCT r.id) AS reports_count,
          COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
          COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits,
          COALESCE(SUM(rm.inquiries), 0) AS total_inquiries
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        LEFT JOIN report_metrics rm ON rm.report_id = r.id
        WHERE p.org_id = ?
          AND p.status = ?
          AND r.status = 'published'
        GROUP BY p.neighborhood
      `).bind(orgId, propertyStatus).all(),
      this.db.prepare(`
        SELECT
          p.neighborhood AS neighborhood,
          COALESCE(SUM(julianday(rd.period_end) - julianday(rd.period_start)), 0) AS total_period_days
        FROM (
          SELECT DISTINCT r.id, r.period_start, r.period_end, r.property_id
          FROM reports r
          JOIN properties p ON p.id = r.property_id
          WHERE p.org_id = ?
            AND p.status = ?
            AND r.status = 'published'
        ) rd
        JOIN properties p ON p.id = rd.property_id
        GROUP BY p.neighborhood
      `).bind(orgId, propertyStatus).all(),
    ])

    const daysMap = new Map<string, number>()
    for (const row of (daysRes.results as any[]) ?? []) {
      daysMap.set(String(row.neighborhood ?? 'Sin barrio'), Math.max(1, Math.round(Number(row.total_period_days ?? 0))))
    }

    return ((metricsRes.results as any[]) ?? []).map(r => ({
      neighborhood: String(r.neighborhood ?? 'Sin barrio'),
      property_count: Number(r.property_count ?? 0),
      reports_count: Number(r.reports_count ?? 0),
      total_portal_visits: Number(r.total_portal_visits ?? 0),
      total_in_person_visits: Number(r.total_in_person_visits ?? 0),
      total_inquiries: Number(r.total_inquiries ?? 0),
      total_days: daysMap.get(String(r.neighborhood ?? 'Sin barrio')) ?? 1,
    }))
  }

  async getSoldBenchmarkByNeighborhood(orgId: string): Promise<NeighborhoodSoldBenchmark[]> {
    const res = await this.db.prepare(`
      SELECT
        p.neighborhood AS neighborhood,
        COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
        COALESCE(SUM(julianday(rd.period_end) - julianday(rd.period_start)), 0) AS total_days
      FROM (
        SELECT DISTINCT r.id, r.period_start, r.period_end, r.property_id
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        WHERE p.org_id = ?
          AND p.status = 'sold'
          AND r.status = 'published'
      ) rd
      JOIN properties p ON p.id = rd.property_id
      LEFT JOIN report_metrics rm ON rm.report_id = rd.id
      GROUP BY p.neighborhood
    `).bind(orgId).all()

    return ((res.results as any[]) ?? []).map(r => ({
      neighborhood: String(r.neighborhood ?? 'Sin barrio'),
      total_portal_visits: Number(r.total_portal_visits ?? 0),
      total_days: Math.max(1, Math.round(Number(r.total_days ?? 0))),
    }))
  }

  async getActiveListingsWithAggregates(orgId: string): Promise<ActiveListingRaw[]> {
    const [metricsRes, daysRes, latestRes] = await Promise.all([
      this.db.prepare(`
        SELECT
          p.id AS property_id,
          p.address AS address,
          p.neighborhood AS neighborhood,
          COUNT(DISTINCT r.id) AS reports_count,
          COALESCE(SUM(rm.portal_visits), 0) AS total_portal_visits,
          COALESCE(SUM(rm.in_person_visits), 0) AS total_in_person_visits
        FROM properties p
        LEFT JOIN reports r ON r.property_id = p.id AND r.status = 'published'
        LEFT JOIN report_metrics rm ON rm.report_id = r.id
        WHERE p.org_id = ?
          AND p.status = 'active'
        GROUP BY p.id
      `).bind(orgId).all(),
      this.db.prepare(`
        SELECT
          p.id AS property_id,
          COALESCE(SUM(julianday(rd.period_end) - julianday(rd.period_start)), 0) AS total_period_days
        FROM properties p
        JOIN (
          SELECT DISTINCT r.id, r.period_start, r.period_end, r.property_id
          FROM reports r
          JOIN properties p ON p.id = r.property_id
          WHERE p.org_id = ?
            AND p.status = 'active'
            AND r.status = 'published'
        ) rd ON rd.property_id = p.id
        GROUP BY p.id
      `).bind(orgId).all(),
      this.db.prepare(`
        SELECT
          r.property_id AS property_id,
          MAX(r.published_at) AS latest_published_at,
          (SELECT r2.period_label FROM reports r2
             WHERE r2.property_id = r.property_id AND r2.status = 'published'
             ORDER BY r2.published_at DESC LIMIT 1) AS latest_period_label
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        WHERE p.org_id = ?
          AND p.status = 'active'
          AND r.status = 'published'
        GROUP BY r.property_id
      `).bind(orgId).all(),
    ])

    const daysByProperty = new Map<string, number>()
    for (const row of (daysRes.results as any[]) ?? []) {
      daysByProperty.set(String(row.property_id), Math.max(1, Math.round(Number(row.total_period_days ?? 0))))
    }

    const latestByProperty = new Map<string, { published_at: string | null; period_label: string | null }>()
    for (const row of (latestRes.results as any[]) ?? []) {
      latestByProperty.set(String(row.property_id), {
        published_at: row.latest_published_at ? String(row.latest_published_at) : null,
        period_label: row.latest_period_label ? String(row.latest_period_label) : null,
      })
    }

    return ((metricsRes.results as any[]) ?? []).map(r => {
      const propId = String(r.property_id)
      const latest = latestByProperty.get(propId) ?? { published_at: null, period_label: null }
      return {
        property_id: propId,
        address: String(r.address ?? ''),
        neighborhood: String(r.neighborhood ?? 'Sin barrio'),
        reports_count: Number(r.reports_count ?? 0),
        total_portal_visits: Number(r.total_portal_visits ?? 0),
        total_in_person_visits: Number(r.total_in_person_visits ?? 0),
        total_days: daysByProperty.get(propId) ?? 1,
        latest_report_published_at: latest.published_at,
        latest_report_period_label: latest.period_label,
      }
    })
  }
}
