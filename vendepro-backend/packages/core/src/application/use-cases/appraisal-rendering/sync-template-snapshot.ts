import { ValidationError } from '@vendepro/core'
import type { AppraisalRepository, AppraisalTemplateRepository } from '@vendepro/core'

export class SyncTemplateSnapshotUseCase {
  constructor(private readonly appraisalRepo: AppraisalRepository, private readonly templateRepo: AppraisalTemplateRepository) {}

  async execute(input: { appraisalId: string; orgId: string }): Promise<{ synced: boolean }> {
    const ap = await this.appraisalRepo.findById(input.appraisalId, input.orgId)
    if (!ap) throw new ValidationError('Tasación no encontrada')
    const templateId = (ap as any).template_id
    if (!templateId) throw new ValidationError('Tasación no tiene template asociado')
    const tpl = await this.templateRepo.findById(templateId)
    if (!tpl) throw new ValidationError('Template no encontrado')
    await this.appraisalRepo.update(input.appraisalId, input.orgId, {
      template_snapshot_json: JSON.stringify(tpl.blocks),
      template_synced_at: new Date().toISOString(),
    })
    return { synced: true }
  }
}
