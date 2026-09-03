import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { LeadPipeline } from '../../../domain/value-objects/lead-stage'

export class GetPendingFollowupsUseCase {
  constructor(private readonly repo: LeadRepository) {}

  /**
   * `pipeline` decide de qué tablero son los seguimientos. Antes no existía y
   * la consulta traía los dos: un comprador con visita pendiente aparecía en
   * el dashboard de captación y sumaba a su contador.
   */
  async execute(
    orgId: string,
    pipeline: LeadPipeline = 'vendedor',
    limit = 10,
  ): Promise<Array<{ id: string; full_name: string; next_step: string | null; next_step_date: string | null; stage: string }>> {
    try {
      const now = new Date().toISOString()
      return await this.repo.findPendingFollowups(orgId, now, limit, pipeline)
    } catch {
      return []
    }
  }
}
