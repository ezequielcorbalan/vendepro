export interface PerformanceTotals {
  reports_published: number
  total_impressions: number
  total_portal_visits: number
  total_in_person_visits: number
  total_offers: number
  /** Suma de días cubiertos por cada reporte publicado (periodo). Usado
   *  para normalizar vis/día y visitas presenciales/semana. */
  total_days: number
}

export interface NeighborhoodPerformanceRow {
  neighborhood: string
  reports_count: number
  avg_impressions: number
  avg_portal_visits: number
  avg_in_person_visits: number
  avg_offers: number
  total_offers: number
  /** Métricas normalizadas agregadas por barrio para el semáforo. */
  total_portal_visits: number
  total_in_person_visits: number
  total_days: number
}

export interface TimelinePointRow {
  month_key: string
  impressions: number
  portal_visits: number
  in_person_visits: number
  offers: number
}

export interface ReportListRow {
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

export interface PaginatedReports {
  total: number
  results: ReportListRow[]
}

// ── Benchmark activos vs vendidos ──────────────────────────────

export interface NeighborhoodGroupTotals {
  neighborhood: string
  property_count: number
  reports_count: number
  total_portal_visits: number
  total_in_person_visits: number
  total_inquiries: number
  total_days: number
}

export interface ActiveListingRaw {
  property_id: string
  address: string
  neighborhood: string
  reports_count: number
  total_portal_visits: number
  total_in_person_visits: number
  total_days: number
  latest_report_published_at: string | null
  latest_report_period_label: string | null
}

export interface NeighborhoodSoldBenchmark {
  neighborhood: string
  total_portal_visits: number
  total_days: number
}

export interface AnalyticsReportRepository {
  getPerformanceTotals(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<PerformanceTotals>

  getNeighborhoodPerformance(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<NeighborhoodPerformanceRow[]>

  getTimelinePerformance(
    orgId: string,
    start: string,
    end: string,
    source: string | null,
  ): Promise<TimelinePointRow[]>

  listReportsWithMetrics(
    orgId: string,
    filters: ReportsListFilters,
  ): Promise<PaginatedReports>

  /** Totales agregados por barrio filtrando por status de propiedad ('sold' o 'active'). */
  getNeighborhoodTotalsByPropertyStatus(
    orgId: string,
    propertyStatus: 'sold' | 'active',
  ): Promise<NeighborhoodGroupTotals[]>

  /** Benchmark del barrio para propiedades vendidas (vis totales + días). */
  getSoldBenchmarkByNeighborhood(orgId: string): Promise<NeighborhoodSoldBenchmark[]>

  /** Todas las propiedades activas (con o sin reports) con métricas agregadas. */
  getActiveListingsWithAggregates(orgId: string): Promise<ActiveListingRaw[]>
}
