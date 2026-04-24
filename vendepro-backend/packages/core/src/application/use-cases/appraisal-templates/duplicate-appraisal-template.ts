import { ValidationError } from '../../../domain/errors/validation-error'
import type { AppraisalTemplateRepository } from '../../ports/repositories/appraisal-template-repository'
import type { IdGenerator } from '../../ports/id-generator'

export class DuplicateAppraisalTemplateUseCase {
  constructor(
    private readonly repo: AppraisalTemplateRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: { sourceId: string; orgId: string; newName?: string }): Promise<{ id: string }> {
    const src = await this.repo.findById(input.sourceId)
    if (!src) throw new ValidationError('Template origen no encontrado')
    if (src.org_id !== null && src.org_id !== input.orgId) {
      throw new ValidationError('No podés duplicar un template de otra org')
    }
    const newId = this.idGen.generate()
    const copy = src.duplicateFor(input.orgId, newId, input.newName)
    await this.repo.save(copy)
    return { id: newId }
  }
}
