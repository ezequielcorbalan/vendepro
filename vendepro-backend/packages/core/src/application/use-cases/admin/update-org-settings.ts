import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import { ConflictError } from '../../../domain/errors/conflict-error'

export interface UpdateOrgSettingsInput {
  orgId: string
  patch: {
    name?: string
    slug?: string
    logo_url?: string | null
    brand_color?: string | null
    canva_template_id?: string | null
    canva_report_template_id?: string | null
  }
}

export class UpdateOrgSettingsUseCase {
  constructor(private readonly repo: OrganizationRepository) {}

  async execute(input: UpdateOrgSettingsInput): Promise<void> {
    try {
      await this.repo.updateSettings(input.orgId, input.patch)
    } catch (err) {
      if (err instanceof Error && /slug.*in use/i.test(err.message)) {
        throw new ConflictError('El identificador ya está en uso')
      }
      throw err
    }
  }
}
