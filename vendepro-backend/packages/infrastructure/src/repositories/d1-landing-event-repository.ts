import { LandingEvent, type LandingEventType } from '@vendepro/core'
import type { LandingEventRepository, AnalyticsRange, AnalyticsSummary } from '@vendepro/core'

export class D1LandingEventRepository implements LandingEventRepository {
  constructor(private readonly db: D1Database) {}

  async save(ev: LandingEvent): Promise<void> {
    const o = ev.toObject()
    await this.db.prepare(`
      INSERT INTO landing_events (id, landing_id, slug, event_type, visitor_id, session_id,
        utm_source, utm_medium, utm_campaign, referrer, user_agent, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(o.id, o.landing_id, o.slug, o.event_type, o.visitor_id, o.session_id,
      o.utm_source, o.utm_medium, o.utm_campaign, o.referrer, o.user_agent, o.created_at).run()
  }

  async countByIpInWindow(_ip: string, _sinceIso: string): Promise<number> {
    // Rate limiting por IP requiere almacenar IP; v1 usa visitor_id como proxy.
    return 0
  }

  async summary(landingId: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
    const pv = await this.countEvents(landingId, 'pageview', range)
    const uv = await this.countUniqueVisitors(landingId, range)
    const cc = await this.countEvents(landingId, 'cta_click', range)
    const fs = await this.countEvents(landingId, 'form_start', range)
    const fsub = await this.countEvents(landingId, 'form_submit', range)
    const pageviewsByDay = await this.pageviewsByDay(landingId, range)
    const topUtm = await this.topUtmSources(landingId, range, 10)
    return {
      pageviews: pv,
      unique_visitors: uv,
      cta_clicks: cc,
      form_starts: fs,
      form_submits: fsub,
      conversion_rate: pv > 0 ? fsub / pv : 0,
      pageviews_by_day: pageviewsByDay,
      top_utm_sources: topUtm,
    }
  }

  async recentByType(landingId: string, type: LandingEventType, limit: number): Promise<LandingEvent[]> {
    const rows = (await this.db.prepare(`
      SELECT * FROM landing_events WHERE landing_id = ? AND event_type = ? ORDER BY created_at DESC LIMIT ?
    `).bind(landingId, type, limit).all()).results as any[]
    return rows.map(r => LandingEvent.fromPersistence({
      id: r.id, landing_id: r.landing_id, slug: r.slug, event_type: r.event_type,
      visitor_id: r.visitor_id, session_id: r.session_id,
      utm_source: r.utm_source, utm_medium: r.utm_medium, utm_campaign: r.utm_campaign,
      referrer: r.referrer, user_agent: r.user_agent, created_at: r.created_at,
    }))
  }

  private async countEvents(landingId: string, type: LandingEventType, range: AnalyticsRange): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS c FROM landing_events WHERE landing_id = ? AND event_type = ? AND created_at >= ? AND created_at < ?
    `).bind(landingId, type, range.since, range.until).first() as any
    return row?.c ?? 0
  }

  private async countUniqueVisitors(landingId: string, range: AnalyticsRange): Promise<number> {
    const row = await this.db.prepare(`
      SELECT COUNT(DISTINCT visitor_id) AS c FROM landing_events
      WHERE landing_id = ? AND event_type = 'pageview' AND visitor_id IS NOT NULL
      AND created_at >= ? AND created_at < ?
    `).bind(landingId, range.since, range.until).first() as any
    return row?.c ?? 0
  }

  private async pageviewsByDay(landingId: string, range: AnalyticsRange) {
    const rows = (await this.db.prepare(`
      SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count
      FROM landing_events
      WHERE landing_id = ? AND event_type = 'pageview' AND created_at >= ? AND created_at < ?
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).bind(landingId, range.since, range.until).all()).results as any[]
    return rows.map(r => ({ date: r.date, count: r.count }))
  }

  private async topUtmSources(landingId: string, range: AnalyticsRange, limit: number) {
    const rows = (await this.db.prepare(`
      SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS count
      FROM landing_events
      WHERE landing_id = ? AND created_at >= ? AND created_at < ?
      GROUP BY COALESCE(utm_source, 'direct')
      ORDER BY count DESC LIMIT ?
    `).bind(landingId, range.since, range.until, limit).all()).results as any[]
    return rows.map(r => ({ source: r.source, count: r.count }))
  }
}
