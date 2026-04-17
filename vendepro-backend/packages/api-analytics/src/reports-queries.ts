// ============================================================
// Analytics helpers — reports & listings performance queries
// ============================================================
// Read-only aggregated queries over `reports`, `report_metrics` and
// `properties`. No domain logic: these are SQL-level aggregations used
// by the `/listings-performance` and `/reports` endpoints in api-analytics.

export type Period = 'week' | 'month' | 'quarter' | 'year'

// ── Semáforo ────────────────────────────────────────────────────
// Clasificación cualitativa de performance de un aviso según
// visualizaciones por día. Metodología: Marcela Genta Operaciones
// Inmobiliarias (Semáforo de visualizaciones).

export type HealthStatus = 'red' | 'orange' | 'yellow' | 'light_green' | 'green'

export const BENCHMARKS = {
  caba: { min_views_per_day: 14, min_in_person_visits_per_week: 1.5 },
  gba:  { min_views_per_day: 8,  min_in_person_visits_per_week: 1.0 },
  color_thresholds: {
    red:          { max_views_per_day: 9 },
    orange:       { max_views_per_day: 13 },
    yellow:       { max_views_per_day: 22 },
    light_green:  { max_views_per_day: 27 },
    green:        { min_views_per_day: 28 },
  },
  source: 'Marcela Genta Operaciones Inmobiliarias — Semáforo de visualizaciones',
} as const

export function computeHealthStatus(viewsPerDay: number): HealthStatus {
  if (!Number.isFinite(viewsPerDay) || viewsPerDay <= 9) return 'red'
  if (viewsPerDay <= 13) return 'orange'
  if (viewsPerDay <= 22) return 'yellow'
  if (viewsPerDay <= 27) return 'light_green'
  return 'green'
}

/** Días completos entre dos fechas ISO (YYYY-MM-DD). Mínimo 1 para evitar div/0. */
export function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO + 'T00:00:00Z').getTime()
  const end = new Date(endISO + 'T00:00:00Z').getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1
  const diffMs = end - start
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, days)
}

export interface PerformanceKpis {
  reports_published: number
  total_impressions: number
  total_portal_visits: number
  total_in_person_visits: number
  total_offers: number
  avg_impressions_per_report: number
  avg_portal_visits_per_report: number
  avg_in_person_visits_per_report: number
  avg_offers_per_report: number
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  overall_health_status: HealthStatus
}

export interface NeighborhoodPerformance {
  neighborhood: string
  reports_count: number
  avg_impressions: number
  avg_portal_visits: number
  avg_in_person_visits: number
  avg_offers: number
  total_offers: number
  avg_views_per_day: number
  avg_in_person_visits_per_week: number
  health_status: HealthStatus
}

export interface TimelinePoint {
  period_label: string
  period_start: string
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

export interface ReportListItem {
  id: string
  property_id: string
  property_address: string
  property_neighborhood: string
  period_label: string
  period_start: string
  period_end: string
  status: string
  published_at: string | null
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
  days_in_period: number
  views_per_day: number
  in_person_visits_per_week: number
  health_status: HealthStatus | null
}

export interface ReportsListFilters {
  page: number
  page_size: number
  neighborhood?: string | null
  status?: string | null
  property_id?: string | null
  from?: string | null
  to?: string | null
}

/**
 * Returns the ISO date (YYYY-MM-DD) that is N units ago from `now`, in UTC.
 */
export function periodStartDate(period: Period, now: Date = new Date()): string {
  const d = new Date(now)
  switch (period) {
    case 'week': d.setDate(d.getDate() - 7); break
    case 'month': d.setMonth(d.getMonth() - 1); break
    case 'quarter': d.setMonth(d.getMonth() - 3); break
    case 'year': d.setFullYear(d.getFullYear() - 1); break
  }
  return d.toISOString().split('T')[0] ?? ''
}

/**
 * Aggregated KPIs for all published reports in the given date range.
 * Reports are filtered by `published_at` ∈ [start, end].
 */
export async function getPerformanceKpis(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<PerformanceKpis> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  // Query 1: métricas agregadas (con JOIN a report_metrics).
  // Query 2 (separada): días totales del período SIN join a metrics, para
  // evitar que reports con múltiples fuentes (ej ZonaProp + MercadoLibre)
  // dupliquen los días al sumar.
  const [row, daysRow] = await Promise.all([
    db.prepare(`
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
    db.prepare(`
      SELECT COALESCE(SUM(julianday(r.period_end) - julianday(r.period_start)), 0) AS total_period_days
      FROM (
        SELECT DISTINCT r.id, r.period_start, r.period_end
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        LEFT JOIN report_metrics rm ON rm.report_id = r.id
        WHERE p.org_id = ?
          AND r.status = 'published'
          AND date(r.published_at) >= ?
          AND date(r.published_at) <= ?
          ${sourceFilter}
      ) r
    `).bind(...binds).first() as Promise<any>,
  ])

  const count = Number(row?.reports_published ?? 0)
  const safeAvg = (total: number): number => count > 0 ? Math.round(total / count) : 0
  const avgFloat = (total: number): number => count > 0 ? Math.round((total / count) * 100) / 100 : 0

  const totalImpressions = Number(row?.total_impressions ?? 0)
  const totalPortalVisits = Number(row?.total_portal_visits ?? 0)
  const totalInPersonVisits = Number(row?.total_in_person_visits ?? 0)
  const totalOffers = Number(row?.total_offers ?? 0)
  const totalPeriodDays = Math.max(1, Math.round(Number(daysRow?.total_period_days ?? 0)))

  // Terminología MG: "visualizaciones" = entradas al aviso = portal_visits
  // (NO impresiones, que son las veces que el aviso aparece en listados).
  // El semáforo se calcula sobre visitas al aviso por día.
  const avgViewsPerDay = count > 0 ? Math.round((totalPortalVisits / totalPeriodDays) * 10) / 10 : 0
  const avgVisitsPerWeek = count > 0 ? Math.round((totalInPersonVisits / (totalPeriodDays / 7)) * 10) / 10 : 0

  return {
    reports_published: count,
    total_impressions: totalImpressions,
    total_portal_visits: totalPortalVisits,
    total_in_person_visits: totalInPersonVisits,
    total_offers: totalOffers,
    avg_impressions_per_report: safeAvg(totalImpressions),
    avg_portal_visits_per_report: safeAvg(totalPortalVisits),
    avg_in_person_visits_per_report: safeAvg(totalInPersonVisits),
    avg_offers_per_report: avgFloat(totalOffers),
    avg_views_per_day: avgViewsPerDay,
    avg_in_person_visits_per_week: avgVisitsPerWeek,
    overall_health_status: computeHealthStatus(avgViewsPerDay),
  }
}

/**
 * Per-neighborhood aggregated metrics, ordered by reports_count desc.
 */
export async function getNeighborhoodPerformance(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<NeighborhoodPerformance[]> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  const [metricsRes, daysRes] = await Promise.all([
    db.prepare(`
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
    // Días del período agrupados por barrio, SIN join a metrics para no duplicar.
    db.prepare(`
      SELECT
        p.neighborhood AS neighborhood,
        COALESCE(SUM(julianday(r.period_end) - julianday(r.period_start)), 0) AS total_period_days
      FROM (
        SELECT DISTINCT r.id, r.period_start, r.period_end, r.property_id
        FROM reports r
        JOIN properties p ON p.id = r.property_id
        LEFT JOIN report_metrics rm ON rm.report_id = r.id
        WHERE p.org_id = ?
          AND r.status = 'published'
          AND date(r.published_at) >= ?
          AND date(r.published_at) <= ?
          ${sourceFilter}
      ) r
      JOIN properties p ON p.id = r.property_id
      GROUP BY p.neighborhood
    `).bind(...binds).all(),
  ])

  const daysByNeighborhood: Record<string, number> = {}
  for (const row of (daysRes.results as any[] ?? [])) {
    daysByNeighborhood[String(row.neighborhood ?? 'Sin barrio')] = Math.max(1, Math.round(Number(row.total_period_days ?? 0)))
  }

  return ((metricsRes.results as any[]) ?? []).map(r => {
    // "Visualizaciones" en terminología MG = entradas al aviso = portal_visits.
    const totalPortalVisits = Number(r.total_portal_visits ?? 0)
    const totalInPersonVisits = Number(r.total_in_person_visits ?? 0)
    const totalDays = daysByNeighborhood[String(r.neighborhood ?? 'Sin barrio')] ?? 1
    const viewsPerDay = Math.round((totalPortalVisits / totalDays) * 10) / 10
    const visitsPerWeek = Math.round((totalInPersonVisits / (totalDays / 7)) * 10) / 10
    return {
      neighborhood: r.neighborhood ?? 'Sin barrio',
      reports_count: Number(r.reports_count ?? 0),
      avg_impressions: Number(r.avg_impressions ?? 0),
      avg_portal_visits: Number(r.avg_portal_visits ?? 0),
      avg_in_person_visits: Number(r.avg_in_person_visits ?? 0),
      avg_offers: Number(r.avg_offers ?? 0),
      total_offers: Number(r.total_offers ?? 0),
      avg_views_per_day: viewsPerDay,
      avg_in_person_visits_per_week: visitsPerWeek,
      health_status: computeHealthStatus(viewsPerDay),
    }
  })
}

/**
 * Monthly aggregated metrics over the period, ordered chronologically.
 */
export async function getTimelinePerformance(
  db: D1Database,
  orgId: string,
  start: string,
  end: string,
  source?: string | null,
): Promise<TimelinePoint[]> {
  const sourceFilter = source ? ' AND rm.source = ?' : ''
  const binds: unknown[] = source ? [orgId, start, end, source] : [orgId, start, end]

  const res = await db.prepare(`
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

  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return ((res.results as any[]) ?? []).map(r => {
    const parts = (r.month_key as string ?? '').split('-')
    const y = parts[0] ?? ''
    const m = parts[1] ?? '01'
    const monthIdx = parseInt(m, 10) - 1
    return {
      period_label: `${MONTHS[monthIdx] ?? m} ${y}`.trim(),
      period_start: `${y}-${m}-01`,
      impressions: Number(r.impressions ?? 0),
      portal_visits: Number(r.portal_visits ?? 0),
      in_person_visits: Number(r.in_person_visits ?? 0),
      offers: Number(r.offers ?? 0),
    }
  })
}

/**
 * Paginated list of reports with aggregated metrics, joined with property info.
 */
export async function listReportsWithMetrics(
  db: D1Database,
  orgId: string,
  filters: ReportsListFilters,
): Promise<{ total: number; results: ReportListItem[] }> {
  const page = Math.max(1, Math.floor(filters.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.page_size) || 20))
  const offset = (page - 1) * pageSize

  const where: string[] = ['p.org_id = ?']
  const binds: unknown[] = [orgId]

  if (filters.neighborhood) {
    where.push('p.neighborhood = ?')
    binds.push(filters.neighborhood)
  }
  if (filters.status) {
    where.push('r.status = ?')
    binds.push(filters.status)
  }
  if (filters.property_id) {
    where.push('r.property_id = ?')
    binds.push(filters.property_id)
  }
  if (filters.from) {
    where.push('date(r.period_end) >= ?')
    binds.push(filters.from)
  }
  if (filters.to) {
    where.push('date(r.period_end) <= ?')
    binds.push(filters.to)
  }

  const whereSql = where.join(' AND ')

  const [countRow, rowsRes] = await Promise.all([
    db.prepare(`
      SELECT COUNT(DISTINCT r.id) AS total
      FROM reports r
      JOIN properties p ON p.id = r.property_id
      WHERE ${whereSql}
    `).bind(...binds).first() as Promise<any>,
    db.prepare(`
      SELECT
        r.id AS id,
        r.property_id AS property_id,
        p.address AS property_address,
        p.neighborhood AS property_neighborhood,
        r.period_label AS period_label,
        r.period_start AS period_start,
        r.period_end AS period_end,
        r.status AS status,
        r.published_at AS published_at,
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
    `).bind(...binds, pageSize, offset).all(),
  ])

  const results = ((rowsRes.results as any[]) ?? []).map(r => {
    const impressions = Number(r.impressions ?? 0)
    const portalVisits = Number(r.portal_visits ?? 0)
    const inPersonVisits = Number(r.in_person_visits ?? 0)
    const days = daysBetween(r.period_start ?? '', r.period_end ?? '')
    // "Visualizaciones" en terminología MG = entradas al aviso = portal_visits.
    const viewsPerDay = Math.round((portalVisits / days) * 10) / 10
    const visitsPerWeek = Math.round((inPersonVisits / (days / 7)) * 10) / 10
    const healthStatus: HealthStatus | null =
      (r.period_start && r.period_end) ? computeHealthStatus(viewsPerDay) : null
    return {
      id: r.id,
      property_id: r.property_id,
      property_address: r.property_address ?? '',
      property_neighborhood: r.property_neighborhood ?? 'Sin barrio',
      period_label: r.period_label ?? '',
      period_start: r.period_start ?? '',
      period_end: r.period_end ?? '',
      status: r.status ?? 'draft',
      published_at: r.published_at ?? null,
      impressions,
      portal_visits: Number(r.portal_visits ?? 0),
      in_person_visits: inPersonVisits,
      offers: Number(r.offers ?? 0),
      days_in_period: days,
      views_per_day: viewsPerDay,
      in_person_visits_per_week: visitsPerWeek,
      health_status: healthStatus,
    }
  })

  return {
    total: Number((countRow as any)?.total ?? 0),
    results,
  }
}
