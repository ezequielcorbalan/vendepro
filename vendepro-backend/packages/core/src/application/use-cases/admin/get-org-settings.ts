import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { Organization } from '../../../domain/entities/organization'

export class GetOrgSettingsUseCase {
  constructor(private readonly repo: OrganizationRepository) {}

  async execute(orgId: string): Promise<Organization | null> {
    return await this.repo.findById(orgId)
  }
}
