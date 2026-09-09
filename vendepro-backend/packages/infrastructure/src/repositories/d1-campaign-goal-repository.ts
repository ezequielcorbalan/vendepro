import type { CampaignGoalRepository, CampaignGoal } from '@vendepro/core'

export class D1CampaignGoalRepository implements CampaignGoalRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string, provider: string): Promise<Map<string, CampaignGoal>> {
    const rows = (await this.db
      .prepare('SELECT campaign_id, goal FROM campaign_goals WHERE org_id = ? AND provider = ?')
      .bind(orgId, provider)
      .all()).results as any[]
    return new Map(rows.map(r => [String(r.campaign_id), r.goal as CampaignGoal]))
  }

  async save(input: {
    orgId: string
    provider: string
    campaignId: string
    goal: CampaignGoal
    campaignName?: string | null
    updatedBy?: string | null
    ownerUserId?: string | null
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO campaign_goals (org_id, provider, campaign_id, goal, campaign_name, owner_user_id, updated_by, updated_at)
      VALUES (?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(org_id, provider, campaign_id) DO UPDATE SET
        goal = excluded.goal,
        campaign_name = excluded.campaign_name,
        owner_user_id = excluded.owner_user_id,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).bind(
      input.orgId, input.provider, input.campaignId, input.goal,
      input.campaignName ?? null, input.ownerUserId ?? null, input.updatedBy ?? null,
    ).run()
  }

  async delete(orgId: string, provider: string, campaignId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM campaign_goals WHERE org_id = ? AND provider = ? AND campaign_id = ?')
      .bind(orgId, provider, campaignId)
      .run()
  }
}
