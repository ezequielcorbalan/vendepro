import type { CampaignGoalRepository } from '../../ports/repositories/campaign-goal-repository'
import { isCampaignGoal, type CampaignGoal } from '../../../domain/value-objects/campaign-goal'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SetCampaignGoalInput {
  orgId: string
  provider?: string
  campaignId: string
  /** `null` saca la etiqueta: la campaña vuelve a "sin clasificar". */
  goal: CampaignGoal | null
  campaignName?: string | null
  updatedBy?: string | null
  ownerUserId?: string | null
}

/**
 * Etiqueta una campaña como captación o demanda.
 *
 * Se guarda contra el id de la campaña en el proveedor, nunca contra el nombre:
 * renombrar en Ads Manager no puede romper la clasificación.
 */
export class SetCampaignGoalUseCase {
  constructor(private readonly repo: CampaignGoalRepository) {}

  async execute(input: SetCampaignGoalInput): Promise<void> {
    const campaignId = input.campaignId?.trim()
    if (!campaignId) throw new ValidationError('Falta la campaña')

    const provider = (input.provider ?? 'meta').trim().toLowerCase()

    if (input.goal === null) {
      await this.repo.delete(input.orgId, provider, campaignId)
      return
    }

    if (!isCampaignGoal(input.goal)) {
      throw new ValidationError(`Objetivo inválido: ${String(input.goal)}`)
    }

    await this.repo.save({
      orgId: input.orgId,
      provider,
      campaignId,
      goal: input.goal,
      campaignName: input.campaignName ?? null,
      updatedBy: input.updatedBy ?? null,
      ownerUserId: input.ownerUserId ?? input.updatedBy ?? null,
    })
  }
}
