import { OrgVariable } from '../../../domain/entities/org-variable'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'

export class UpdateOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { id: string; orgId: string; value?: string; label?: string | null }) {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Variable no encontrada')
    if (cur.org_id !== input.orgId) throw new ValidationError('Variable pertenece a otra org')
    const o = cur.toObject()
    const next = OrgVariable.create({
      ...o,
      value: input.value !== undefined ? input.value : o.value,
      label: input.label !== undefined ? input.label : o.label,
      updated_at: new Date().toISOString(),
    })
    await this.repo.save(next)
    return { updated: true }
  }
}
