import { ValidationError } from '../../../domain/errors/validation-error'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'

export class DeleteOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { id: string; orgId: string }): Promise<{ deleted: boolean }> {
    const cur = await this.repo.findById(input.id)
    if (!cur) throw new ValidationError('Variable no encontrada')
    if (cur.org_id !== input.orgId) throw new ValidationError('Variable pertenece a otra org')
    if (cur.isSystem()) throw new ValidationError('No se puede eliminar una variable del sistema')
    await this.repo.delete(input.id)
    return { deleted: true }
  }
}
