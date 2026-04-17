import { Report } from '@vendepro/core'
import type { ReportRepository, NewReportMetric, NewReportContent } from '@vendepro/core'
import type { ReportMetricProps, ReportContentProps } from '@vendepro/core'

/**
 * D1 adapter for `reports` plus children (`report_metrics`, `report_content`,
 * `report_photos`).
 *
 * Schema notes:
 * - `reports.org_id` was added by migration 006 (nullable). The entity has no
 *   `org_id` field on its props, so the adapter derives it from the linked
 *   property on save (`SELECT org_id FROM properties WHERE id = ?`). Queries
 *   scope via `reports.org_id` directly.
 * - `reports` has no `public_slug` column, so `findPublicBySlug()` returns null.
 * - Children have `ON DELETE CASCADE`, but we also delete them explicitly from
 *   the adapter to make cascade behavior explicit and portable.
 */
export class D1ReportRepository implements ReportRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Report | null> {
    const row = (await this.db
      .prepare(`SELECT * FROM reports WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findByProperty(propertyId: string, orgId: string): Promise<Report[]> {
    const rows = ((await this.db
      .prepare(
        `SELECT * FROM reports WHERE property_id = ? AND org_id = ? ORDER BY created_at DESC`,
      )
      .bind(propertyId, orgId)
      .all()).results as any[]) || []
    return rows.map((r) => this.toEntity(r))
  }

  async findPublicBySlug(_slug: string): Promise<Report | null> {
    // reports has no public_slug column in the v2 schema.
    return null
  }

  async findLatestPublishedByProperty(propertyId: string): Promise<Report | null> {
    const row = (await this.db
      .prepare(
        `SELECT * FROM reports WHERE property_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(propertyId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async save(report: Report): Promise<void> {
    const o = report.toObject()
    // Derive org_id from the owning property on insert so scoping works across
    // all queries. On conflict we leave org_id alone (it was set at insert time).
    await this.db
      .prepare(
        `INSERT INTO reports (
           id, property_id, period_label, period_start, period_end,
           status, created_by, created_at, published_at, org_id
         )
         VALUES (?,?,?,?,?,?,?,?,?, (SELECT org_id FROM properties WHERE id = ?))
         ON CONFLICT(id) DO UPDATE SET
           property_id=excluded.property_id,
           period_label=excluded.period_label,
           period_start=excluded.period_start,
           period_end=excluded.period_end,
           status=excluded.status,
           created_by=excluded.created_by,
           published_at=excluded.published_at`,
      )
      .bind(
        o.id, o.property_id, o.period_label, o.period_start, o.period_end,
        o.status, o.created_by, o.created_at, o.published_at, o.property_id,
      )
      .run()
  }

  async findByOrg(orgId: string, propertyId?: string): Promise<Report[]> {
    let query: string
    let result: any
    if (propertyId) {
      result = await this.db
        .prepare('SELECT * FROM reports WHERE property_id = ? AND org_id = ? ORDER BY created_at DESC')
        .bind(propertyId, orgId)
        .all()
    } else {
      result = await this.db
        .prepare('SELECT r.*, p.address FROM reports r LEFT JOIN properties p ON r.property_id = p.id WHERE r.org_id = ? ORDER BY r.created_at DESC')
        .bind(orgId)
        .all()
    }
    return ((result.results as any[]) || []).map((r) => this.toEntity(r))
  }

  async delete(id: string, orgId: string): Promise<void> {
    // Explicit cascade — also guarded by FK ON DELETE CASCADE, but doing it
    // here makes the behavior portable if FKs are ever disabled.
    await this.db
      .prepare(
        `DELETE FROM report_photos WHERE report_id IN (SELECT id FROM reports WHERE id = ? AND org_id = ?)`,
      )
      .bind(id, orgId)
      .run()
    await this.db
      .prepare(
        `DELETE FROM report_content WHERE report_id IN (SELECT id FROM reports WHERE id = ? AND org_id = ?)`,
      )
      .bind(id, orgId)
      .run()
    await this.db
      .prepare(
        `DELETE FROM report_metrics WHERE report_id IN (SELECT id FROM reports WHERE id = ? AND org_id = ?)`,
      )
      .bind(id, orgId)
      .run()
    await this.db.prepare('DELETE FROM reports WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  async findMetrics(reportId: string): Promise<ReportMetricProps[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM report_metrics WHERE report_id = ?')
      .bind(reportId)
      .all()).results as any[]) || []
    return rows.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      source: r.source,
      impressions: r.impressions ?? null,
      portal_visits: r.portal_visits ?? null,
      inquiries: r.inquiries ?? null,
      phone_calls: r.phone_calls ?? null,
      whatsapp: r.whatsapp ?? null,
      in_person_visits: r.in_person_visits ?? null,
      offers: r.offers ?? null,
      ranking_position: r.ranking_position ?? null,
      avg_market_price: r.avg_market_price ?? null,
      screenshot_url: r.screenshot_url ?? null,
      extracted_at: r.extracted_at ?? null,
    }))
  }

  async findContent(reportId: string): Promise<ReportContentProps[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM report_content WHERE report_id = ?')
      .bind(reportId)
      .all()).results as any[]) || []
    return rows.map((r) => ({
      id: r.id,
      report_id: r.report_id,
      section: r.section,
      title: r.title ?? '',
      body: r.body ?? '',
      sort_order: r.sort_order ?? 0,
    }))
  }

  async replaceMetrics(reportId: string, metrics: NewReportMetric[]): Promise<void> {
    await this.db.prepare('DELETE FROM report_metrics WHERE report_id = ?').bind(reportId).run()
    for (const m of metrics) {
      await this.db
        .prepare(
          `INSERT INTO report_metrics (id, report_id, source, impressions, portal_visits, inquiries, phone_calls, whatsapp, in_person_visits, offers, ranking_position, avg_market_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          m.id, m.report_id, m.source,
          m.impressions ?? null, m.portal_visits ?? null, m.inquiries ?? null,
          m.phone_calls ?? null, m.whatsapp ?? null, m.in_person_visits ?? null,
          m.offers ?? null, m.ranking_position ?? null, m.avg_market_price ?? null,
        )
        .run()
    }
  }

  async replaceContent(reportId: string, content: NewReportContent[]): Promise<void> {
    await this.db.prepare('DELETE FROM report_content WHERE report_id = ?').bind(reportId).run()
    for (const c of content) {
      if (c.body) {
        await this.db
          .prepare(
            `INSERT INTO report_content (id, report_id, section, title, body, sort_order) VALUES (?, ?, ?, ?, ?, 0)`,
          )
          .bind(c.id, c.report_id, c.section, c.title ?? '', c.body)
          .run()
      }
    }
  }

  async findReportRaw(id: string): Promise<Record<string, unknown> | null> {
    const row = await this.db.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first() as any
    return row ?? null
  }

  async deleteCompetitorLinks(propertyId: string): Promise<void> {
    await this.db.prepare('DELETE FROM competitor_links WHERE property_id = ?').bind(propertyId).run()
  }

  async addCompetitorLink(link: { id: string; property_id: string; url: string; address: string | null; price: number | null; notes: string | null }): Promise<void> {
    await this.db
      .prepare('INSERT INTO competitor_links (id, property_id, url, address, price, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(link.id, link.property_id, link.url, link.address ?? null, link.price ?? null, link.notes ?? null)
      .run()
  }

  async findCompetitorLinks(propertyId: string): Promise<Record<string, unknown>[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM competitor_links WHERE property_id = ?')
      .bind(propertyId)
      .all()).results as any[]) || []
    return rows
  }

  async findPhotosByReport(reportId: string): Promise<Array<{ id: string; photo_url: string; r2_key?: string }>> {
    const rows = ((await this.db
      .prepare('SELECT * FROM report_photos WHERE report_id = ?')
      .bind(reportId)
      .all()).results as any[]) || []
    return rows.map((r) => ({ id: r.id, photo_url: r.photo_url, r2_key: r.r2_key ?? undefined }))
  }

  private toEntity(row: any): Report {
    return Report.create({
      id: row.id,
      property_id: row.property_id,
      period_label: row.period_label,
      period_start: row.period_start,
      period_end: row.period_end,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      published_at: row.published_at ?? null,
    })
  }
}
