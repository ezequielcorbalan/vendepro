import type { EmailAutomationSendRepository, AutomationSendRow } from '@vendepro/core'

export class D1EmailAutomationSendRepository implements EmailAutomationSendRepository {
  constructor(private readonly db: D1Database) {}

  async record(row: Omit<AutomationSendRow, 'sent_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO email_automation_sends (id, org_id, automation_id, enrollment_id, step_order, email, status, error)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(row.id, row.org_id, row.automation_id, row.enrollment_id, row.step_order, row.email, row.status, row.error).run()
  }

  async countByAutomation(automationId: string, orgId: string): Promise<{ sent: number; failed: number }> {
    const { results } = await this.db.prepare(`
      SELECT status, COUNT(*) as n FROM email_automation_sends
      WHERE automation_id = ? AND org_id = ?
      GROUP BY status
    `).bind(automationId, orgId).all()
    let sent = 0, failed = 0
    for (const r of results as any[]) {
      if (r.status === 'sent') sent = r.n
      else if (r.status === 'failed') failed = r.n
    }
    return { sent, failed }
  }

  async deleteByAutomation(automationId: string, orgId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM email_automation_sends WHERE automation_id = ? AND org_id = ?`).bind(automationId, orgId).run()
  }
}
