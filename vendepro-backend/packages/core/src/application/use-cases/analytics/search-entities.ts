import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { ContactRepository } from '../../ports/repositories/contact-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'

export interface SearchHit {
  type: 'lead' | 'contact' | 'property'
  id: string
  label: string
}

export class SearchEntitiesUseCase {
  constructor(
    private readonly leads: LeadRepository,
    private readonly contacts: ContactRepository,
    private readonly properties: PropertyRepository,
  ) {}

  async execute(orgId: string, query: string, limitPerType = 5): Promise<SearchHit[]> {
    if (!query || query.length < 2) return []
    const [leads, contacts, properties] = await Promise.all([
      this.leads.searchByName(orgId, query, limitPerType),
      this.contacts.searchByName(orgId, query, limitPerType),
      this.properties.searchByAddress(orgId, query, limitPerType),
    ])
    return [
      ...leads.map(l => ({ type: 'lead' as const, id: l.id, label: l.full_name })),
      ...contacts.map(c => ({ type: 'contact' as const, id: c.id, label: c.full_name })),
      ...properties.map(p => ({ type: 'property' as const, id: p.id, label: p.address })),
    ]
  }
}
