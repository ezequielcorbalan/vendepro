import type { ApiToken } from '../../../domain/entities/api-token'

export interface ApiTokenRepository {
  save(token: ApiToken): Promise<void>
  findById(id: string): Promise<ApiToken | null>
  findByOrg(orgId: string): Promise<ApiToken[]>
  revoke(id: string, orgId: string): Promise<void>
  delete(id: string, orgId: string): Promise<void>
  touchLastUsed(id: string): Promise<void>
}
