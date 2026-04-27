import { AppraisalPdf } from '@vendepro/core'
import type { AppraisalPdfRepository } from '@vendepro/core'

export class D1AppraisalPdfRepository implements AppraisalPdfRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<AppraisalPdf | null> {
    const row = await this.db.prepare(`SELECT * FROM appraisal_pdfs WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async findCachedByHash(contentHash: string, now: Date): Promise<AppraisalPdf | null> {
    const row = await this.db.prepare(
      `SELECT * FROM appraisal_pdfs WHERE content_hash = ? AND expires_at > ? ORDER BY generated_at DESC LIMIT 1`,
    ).bind(contentHash, now.toISOString()).first() as any
    return row ? this.toEntity(row) : null
  }

  async save(pdf: AppraisalPdf): Promise<void> {
    const o = pdf.toObject()
    await this.db.prepare(`
      INSERT INTO appraisal_pdfs (id, org_id, appraisal_id, content_hash, r2_key, size_bytes, generated_at, expires_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET content_hash=excluded.content_hash, r2_key=excluded.r2_key,
        size_bytes=excluded.size_bytes, generated_at=excluded.generated_at, expires_at=excluded.expires_at
    `).bind(o.id, o.org_id, o.appraisal_id, o.content_hash, o.r2_key, o.size_bytes, o.generated_at, o.expires_at).run()
  }

  async countByOrgSince(orgId: string, sinceIso: string): Promise<number> {
    const r = await this.db.prepare(
      `SELECT COUNT(*) as n FROM appraisal_pdfs WHERE org_id = ? AND generated_at >= ?`,
    ).bind(orgId, sinceIso).first() as any
    return Number(r?.n ?? 0)
  }

  async deleteExpired(now: Date): Promise<number> {
    const r = await this.db.prepare(`DELETE FROM appraisal_pdfs WHERE expires_at < ?`).bind(now.toISOString()).run()
    return (r.meta as any)?.changes ?? 0
  }

  private toEntity(row: any): AppraisalPdf {
    return AppraisalPdf.fromPersistence({
      id: row.id, org_id: row.org_id, appraisal_id: row.appraisal_id,
      content_hash: row.content_hash, r2_key: row.r2_key, size_bytes: row.size_bytes ?? 0,
      generated_at: row.generated_at, expires_at: row.expires_at,
    })
  }
}
