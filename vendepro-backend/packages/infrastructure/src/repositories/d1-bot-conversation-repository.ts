import type { BotConversation, BotConversationRepository, BotStep, BotStatus } from '@vendepro/core'

export class D1BotConversationRepository implements BotConversationRepository {
  constructor(private readonly db: D1Database) {}

  async findActiveByPhone(phone: string, orgId: string): Promise<BotConversation | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM bot_conversations
         WHERE phone = ? AND org_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(phone, orgId)
      .first() as any
    if (!row) return null
    return this.toEntity(row)
  }

  async findByLeadId(leadId: string, orgId: string): Promise<BotConversation | null> {
    const row = await this.db
      .prepare(
        'SELECT * FROM bot_conversations WHERE lead_id = ? AND org_id = ? LIMIT 1',
      )
      .bind(leadId, orgId)
      .first() as any
    if (!row) return null
    return this.toEntity(row)
  }

  async findActiveByOrg(orgId: string, limit = 50): Promise<BotConversation[]> {
    const rows = (await this.db
      .prepare(
        `SELECT * FROM bot_conversations
         WHERE org_id = ? AND status = 'active'
         ORDER BY updated_at DESC LIMIT ?`,
      )
      .bind(orgId, limit)
      .all()).results as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async save(conversation: BotConversation): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO bot_conversations (id, org_id, lead_id, phone, current_step, answers, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           lead_id = excluded.lead_id,
           current_step = excluded.current_step,
           answers = excluded.answers,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        conversation.id,
        conversation.org_id,
        conversation.lead_id,
        conversation.phone,
        conversation.current_step,
        JSON.stringify(conversation.answers),
        conversation.status,
        conversation.created_at,
        conversation.updated_at,
      )
      .run()
  }

  private toEntity(row: any): BotConversation {
    let answers: Record<string, string> = {}
    try { answers = JSON.parse(row.answers || '{}') } catch { /* empty */ }
    return {
      id: row.id,
      org_id: row.org_id,
      lead_id: row.lead_id ?? null,
      phone: row.phone,
      current_step: row.current_step as BotStep,
      answers,
      status: row.status as BotStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  }
}
