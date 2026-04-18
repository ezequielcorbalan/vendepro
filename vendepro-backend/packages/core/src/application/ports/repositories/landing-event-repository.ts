import type { LandingEvent, LandingEventType } from '../../../domain/entities/landing-event'

export interface AnalyticsRange { since: string; until: string }

export interface AnalyticsSummary {
  pageviews: number
  unique_visitors: number
  cta_clicks: number
  form_starts: number
  form_submits: number
  conversion_rate: number
  pageviews_by_day: Array<{ date: string; count: number }>
  top_utm_sources: Array<{ source: string; count: number }>
}

export interface LandingEventRepository {
  save(event: LandingEvent): Promise<void>
  countByIpInWindow(ip: string, sinceIso: string): Promise<number>
  summary(landingId: string, range: AnalyticsRange): Promise<AnalyticsSummary>
  recentByType(landingId: string, type: LandingEventType, limit: number): Promise<LandingEvent[]>
}
