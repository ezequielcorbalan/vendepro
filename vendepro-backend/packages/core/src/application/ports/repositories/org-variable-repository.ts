import type { OrgVariable, OrgVariableNamespace } from '../../../domain/entities/org-variable'

export interface OrgVariableRepository {
  findById(id: string): Promise<OrgVariable | null>
  findByKey(orgId: string, key: string): Promise<OrgVariable | null>
  listByOrg(orgId: string, namespace?: OrgVariableNamespace): Promise<OrgVariable[]>
  save(variable: OrgVariable): Promise<void>
  delete(id: string): Promise<void>
  /** Bulk resolve keys → value map; missing keys are omitted. */
  resolveKeys(orgId: string, keys: string[]): Promise<Record<string, OrgVariable>>
}
