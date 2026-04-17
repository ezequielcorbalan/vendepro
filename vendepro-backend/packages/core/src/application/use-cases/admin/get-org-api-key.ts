import type { OrganizationRepository } from '../../ports/repositories/organization-repository'

export class GetOrgApiKeyUseCase {
  constructor(private readonly repo: OrganizationRepository) {}

  async execute(orgId: string): Promise<{ has_key: boolean; api_key_masked: string | null }> {
    const key = await this.repo.getApiKey(orgId)
    if (!key) return { has_key: false, api_key_masked: null }
    const masked = `vp_live_••••••••••••${key.slice(-4)}`
    return { has_key: true, api_key_masked: masked }
  }
}
