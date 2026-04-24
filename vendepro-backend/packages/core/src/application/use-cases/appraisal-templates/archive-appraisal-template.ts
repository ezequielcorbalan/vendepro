import { AppraisalTemplate } from '../../../domain/entities/appraisal-template'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'

export class ArchiveAppraisalTemplateUseCase {
  constructor(private readonly repo: AppraisalTemplateRepository) {}

  async execute(input: { id: string; orgId: string }): Promise<{ archived: boolean }> {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Template no encontrado')
    if (cur.isSystem()) throw new ValidationError('No se pueden archivar templates del sistema')
    if (cur.org_id !== input.orgId) throw new ValidationError('Template pertenece a otra org')

    const o = cur.toObject()
    const next = AppraisalTemplate.create({ ...o, active: false, updated_at: new Date().toISOString() })
    await this.repo.save(next)
    return { archived: true }
  }
}
