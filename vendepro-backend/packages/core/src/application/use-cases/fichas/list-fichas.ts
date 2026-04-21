import type { FichaRepository, FichaFilters } from '../../ports/repositories/ficha-repository'
import type { FichaTasacion } from '../../../domain/entities/ficha-tasacion'

export interface ListFichasInput {
  org_id: string
  lead_id?: string | null
  contact_id?: string | null // accepted for API symmetry; schema has no contact_id yet
  agent_id?: string | null
}

export class ListFichasUseCase {
  constructor(private readonly repo: FichaRepository) {}

  async execute(input: ListFichasInput): Promise<FichaTasacion[]> {
    if (input.lead_id) {
      return this.repo.findByLead(input.lead_id, input.org_id)
    }
    const filters: FichaFilters = {}
    if (input.agent_id) filters.agent_id = input.agent_id
    return this.repo.findByOrg(input.org_id, filters)
  }
}
