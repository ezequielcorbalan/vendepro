import type { OrgIntegrationRepository } from '../../ports/repositories/org-integration-repository'

/** Vista pública de la integración (sin credenciales) o null si no existe. */
export class GetOrgIntegrationUseCase {
  constructor(private readonly repo: OrgIntegrationRepository) {}

  async execute(input: { orgId: string; provider: string }) {
    const integration = await this.repo.findByOrgAndProvider(input.orgId, input.provider)
    return integration?.toPublicView() ?? null
  }
}
