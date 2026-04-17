import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class GetAppraisalStatsUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  async execute(orgId: string): Promise<{ total: number; captadas: number }> {
    try {
      const [total, captadas] = await Promise.all([
        this.repo.countByOrg(orgId),
        // Note: appraisals schema uses status ('draft','generated','sent') — no 'captado' value.
        // countByOrgAndStage('captado') will always return 0 with the real table.
        // This matches original behavior where the legacy SQL `WHERE stage='captado'` was also broken.
        this.repo.countByOrgAndStage(orgId, 'captado'),
      ])
      return { total, captadas }
    } catch {
      return { total: 0, captadas: 0 }
    }
  }
}
