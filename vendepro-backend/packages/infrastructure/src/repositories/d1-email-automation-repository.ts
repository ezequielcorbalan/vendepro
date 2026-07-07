import { EmailAutomation } from '@vendepro/core'
import type { EmailAutomationRepository } from '@vendepro/core'

export class D1EmailAutomationRepository implements EmailAutomationRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<EmailAutomation | null> {
    const row = await this.db
      .prepare(`SELECT * FROM email_automations WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async listByOrg(orgId: string, limit = 50): Promise<EmailAutomation[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM email_automations WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`)
      .bind(orgId, limit)
      .all()
    return (results as any[]).map(r => this.toEntity(r))
  }

  async listActiveByTrigger(triggerEvent: string): Promise<EmailAutomation[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM email_automations WHERE trigger_event = ? AND status = 'active'`)
      .bind(triggerEvent)
      .all()
    return (results as any[]).map(r => this.toEntity(r))
  }

  async save(automation: EmailAutomation): Promise<void> {
    const o = automation.toObject()
    await this.db.prepare(`
      INSERT INTO email_automations (
        id, org_id, name, status, trigger_event, trigger_filter_json,
        steps_json, created_by, created_at, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        status=excluded.status,
        trigger_event=excluded.trigger_event,
        trigger_filter_json=excluded.trigger_filter_json,
        steps_json=excluded.steps_json,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.status, o.trigger_event, o.trigger_filter_json,
      o.steps_json, o.created_by, o.created_at, o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM email_automations WHERE id = ? AND org_id = ?`).bind(id, orgId).run()
  }

  private toEntity(row: any): EmailAutomation {
    return EmailAutomation.fromPersistence({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      status: row.status,
      trigger_event: row.trigger_event ?? null,
      trigger_filter_json: row.trigger_filter_json ?? null,
      steps_json: row.steps_json ?? null,
      created_by: row.created_by ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
