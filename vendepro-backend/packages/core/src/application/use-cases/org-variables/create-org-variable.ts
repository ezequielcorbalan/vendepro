import { OrgVariable } from '../../../domain/entities/org-variable'
import { ValidationError } from '../../../domain/errors/validation-error'
import type { OrgVariableRepository } from '../../ports/repositories/org-variable-repository'
import type { OrgVariableType, OrgVariableNamespace } from '../../../domain/entities/org-variable'
import type { IdGenerator } from '../../ports/id-generator'

export interface CreateOrgVariableInput {
  orgId: string; key: string; value: string; value_type: OrgVariableType
  label: string | null; namespace: OrgVariableNamespace
}

export class CreateOrgVariableUseCase {
  constructor(private readonly repo: OrgVariableRepository, private readonly idGen: IdGenerator) {}
  async execute(input: CreateOrgVariableInput): Promise<{ id: string }> {
    const existing = await this.repo.findByKey(input.orgId, input.key)
    if (existing) throw new ValidationError(`Ya existe una variable con key "${input.key}" en la org`)
    const id = this.idGen.generate()
    const v = OrgVariable.create({ id, org_id: input.orgId, key: input.key, value: input.value,
      value_type: input.value_type, label: input.label, namespace: input.namespace, is_system: false })
    await this.repo.save(v)
    return { id }
  }
}
