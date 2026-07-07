import type { EmailAutomationEnrollmentRepository, EnrollmentRow } from '@vendepro/core'

export class D1EmailAutomationEnrollmentRepository implements EmailAutomationEnrollmentRepository {
  constructor(private readonly db: D1Database) {}

  async insertMany(rows: Array<Pick<EnrollmentRow, 'id' | 'org_id' | 'automation_id' | 'email' | 'name' | 'contact_id' | 'lead_id' | 'next_run_at'>>): Promise<void> {
    if (rows.length === 0) return
    const stmt = this.db.prepare(`
      INSERT INTO email_automation_enrollments (id, org_id, automation_id, email, name, contact_id, lead_id, next_run_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(automation_id, email) DO NOTHING
    `)
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      await this.db.batch(chunk.map(r =>
        stmt.bind(r.id, r.org_id, r.automation_id, r.email, r.name, r.contact_id, r.lead_id, r.next_run_at),
      ))
    }
  }

  async listDue(now: string, limit: number): Promise<EnrollmentRow[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM email_automation_enrollments
      WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
      ORDER BY next_run_at ASC
      LIMIT ?
    `).bind(now, limit).all()
    return results as unknown as EnrollmentRow[]
  }

  async advance(id: string, nextStep: number, nextRunAt: string): Promise<void> {
    await this.db.prepare(`
      UPDATE email_automation_enrollments SET current_step = ?, next_run_at = ? WHERE id = ?
    `).bind(nextStep, nextRunAt, id).run()
  }

  async finish(id: string, status: 'completed' | 'cancelled' | 'unsubscribed'): Promise<void> {
    await this.db.prepare(`
      UPDATE email_automation_enrollments SET status = ?, next_run_at = NULL WHERE id = ?
    `).bind(status, id).run()
  }

  async listByAutomation(automationId: string, orgId: string, limit = 200): Promise<EnrollmentRow[]> {
    const { results } = await this.db.prepare(`
      SELECT * FROM email_automation_enrollments
      WHERE automation_id = ? AND org_id = ?
      ORDER BY enrolled_at DESC
      LIMIT ?
    `).bind(automationId, orgId, limit).all()
    return results as unknown as EnrollmentRow[]
  }

  async countByStatus(automationId: string, orgId: string): Promise<Record<string, number>> {
    const { results } = await this.db.prepare(`
      SELECT status, COUNT(*) as n FROM email_automation_enrollments
      WHERE automation_id = ? AND org_id = ?
      GROUP BY status
    `).bind(automationId, orgId).all()
    const out: Record<string, number> = {}
    for (const r of results as any[]) out[r.status] = r.n
    return out
  }

  async deleteByAutomation(automationId: string, orgId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM email_automation_enrollments WHERE automation_id = ? AND org_id = ?`).bind(automationId, orgId).run()
  }
}
