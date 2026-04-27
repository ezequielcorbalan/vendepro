import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'
import type { OrgVariableNamespace } from '../../../domain/entities/org-variable'

export class ListOrgVariablesUseCase {
  constructor(private readonly repo: OrgVariableRepository) {}
  async execute(input: { orgId: string; namespace?: OrgVariableNamespace }) {
    const list = await this.repo.listByOrg(input.orgId, input.namespace)
    return list.map(v => v.toObject())
  }
}
