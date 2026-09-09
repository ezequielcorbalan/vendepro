import type { CampaignGoal } from '../../../domain/value-objects/campaign-goal'

export interface CampaignGoalRepository {
  /** Etiquetas de la org, indexadas por `campaign_id` del proveedor. */
  findByOrg(orgId: string, provider: string): Promise<Map<string, CampaignGoal>>
  save(input: {
    orgId: string
    provider: string
    campaignId: string
    goal: CampaignGoal
    campaignName?: string | null
    updatedBy?: string | null
    /** Dueño de la cuenta publicitaria donde vive la campaña. */
    ownerUserId?: string | null
  }): Promise<void>
  /** Saca la etiqueta: la campaña vuelve a "sin clasificar". */
  delete(orgId: string, provider: string, campaignId: string): Promise<void>
}
