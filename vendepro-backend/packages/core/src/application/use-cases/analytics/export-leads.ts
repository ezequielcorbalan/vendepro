import type { LeadRepository } from '../../ports/repositories/lead-repository'

export class ExportLeadsUseCase {
  constructor(private readonly repo: LeadRepository) {}

  async execute(orgId: string): Promise<Array<Record<string, unknown>>> {
    return await this.repo.exportAllWithAssignedName(orgId)
  }
}
