import { Report } from '@vendepro/core'
import type { ReportRepository } from '@vendepro/core'

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
