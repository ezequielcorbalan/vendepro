import type { OrganizationRepository } from '../../ports/repositories/organization-repository'

export class GenerateOrgApiKeyUseCase {
  constructor(private readonly repo: OrganizationRepository) {}

  async execute(orgId: string): Promise<{ api_key: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const hex = Array.from(bytes).map((b: number) => b.toString(16).padStart(2, '0')).join('')
    const apiKey = `vp_live_${hex}`
    await this.repo.setApiKey(orgId, apiKey)
    return { api_key: apiKey }
  }
}
