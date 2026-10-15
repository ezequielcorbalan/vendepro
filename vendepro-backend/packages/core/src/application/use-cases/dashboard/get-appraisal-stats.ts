import type { AppraisalRepository } from '../../ports/repositories/appraisal-repository'

export class GetAppraisalStatsUseCase {
  constructor(private readonly repo: AppraisalRepository) {}

  /**
   * `agentId`: el dashboard de un agente cuenta SUS tasaciones. Antes contaba
   * las de toda la inmobiliaria aunque el resto de sus números fueran propios.
   */
  async execute(orgId: string, agentId?: string): Promise<{ total: number; captadas: number }> {
    try {
      const [total, captadas] = await Promise.all([
        agentId ? this.repo.countByAgent(orgId, agentId) : this.repo.countByOrg(orgId),
        // Note: appraisals schema uses status ('draft','generated','sent') — no 'captado' value.
        // countByOrgAndStage('captado') will always return 0 with the real table.
        // This matches original behavior where the legacy SQL `WHERE stage='captado'` was also broken.
        // Para un agente no se consulta: el conteo es de toda la org y hoy
        // siempre da 0 (ver arriba). Si algún día existe la etapa, hay que
        // agregarle el filtro por agente antes de mostrarlo.
        agentId ? Promise.resolve(0) : this.repo.countByOrgAndStage(orgId, 'captado'),
      ])
      return { total, captadas }
    } catch {
      return { total: 0, captadas: 0 }
    }
  }
}
