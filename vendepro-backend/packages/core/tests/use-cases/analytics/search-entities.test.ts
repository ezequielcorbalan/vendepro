import { describe, it, expect, vi } from 'vitest'
import { SearchEntitiesUseCase } from '../../../src/application/use-cases/analytics/search-entities'

function makeLeadRepo() {
  return {
    findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    searchByName: vi.fn(), findPendingFollowups: vi.fn(), exportAllWithAssignedName: vi.fn(),
  }
}

function makeContactRepo() {
  return {
    findById: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    searchByName: vi.fn(), findWithLeadsAndProperties: vi.fn(),
  }
}

function makePropertyRepo() {
  return {
    findById: vi.fn(), findBySlug: vi.fn(), findByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(),
    findPhotos: vi.fn(), addPhoto: vi.fn(), deletePhoto: vi.fn(), reorderPhotos: vi.fn(),
    update: vi.fn(), updateStage: vi.fn(), findCatalogs: vi.fn(),
    markExternalReport: vi.fn(), clearExternalReport: vi.fn(), searchByAddress: vi.fn(),
  }
}

describe('SearchEntitiesUseCase', () => {
  it('returns empty array for short queries', async () => {
    const uc = new SearchEntitiesUseCase(makeLeadRepo(), makeContactRepo(), makePropertyRepo())
    expect(await uc.execute('org1', 'a')).toEqual([])
    expect(await uc.execute('org1', '')).toEqual([])
  })

  it('merges results from all three repos with correct types', async () => {
    const leads = makeLeadRepo()
    const contacts = makeContactRepo()
    const props = makePropertyRepo()

    leads.searchByName.mockResolvedValue([{ id: 'l1', full_name: 'Ana López' }])
    contacts.searchByName.mockResolvedValue([{ id: 'c1', full_name: 'Ana Torres' }])
    props.searchByAddress.mockResolvedValue([{ id: 'p1', address: 'Av. Ana 123' }])

    const uc = new SearchEntitiesUseCase(leads, contacts, props)
    const results = await uc.execute('org1', 'Ana', 5)

    expect(results).toHaveLength(3)
    expect(results.find(r => r.type === 'lead')).toMatchObject({ type: 'lead', id: 'l1', label: 'Ana López' })
    expect(results.find(r => r.type === 'contact')).toMatchObject({ type: 'contact', id: 'c1', label: 'Ana Torres' })
    expect(results.find(r => r.type === 'property')).toMatchObject({ type: 'property', id: 'p1', label: 'Av. Ana 123' })
  })

  it('passes orgId and limitPerType to each repo', async () => {
    const leads = makeLeadRepo()
    const contacts = makeContactRepo()
    const props = makePropertyRepo()
    leads.searchByName.mockResolvedValue([])
    contacts.searchByName.mockResolvedValue([])
    props.searchByAddress.mockResolvedValue([])

    await new SearchEntitiesUseCase(leads, contacts, props).execute('org42', 'test', 3)

    expect(leads.searchByName).toHaveBeenCalledWith('org42', 'test', 3)
    expect(contacts.searchByName).toHaveBeenCalledWith('org42', 'test', 3)
    expect(props.searchByAddress).toHaveBeenCalledWith('org42', 'test', 3)
  })

  it('returns only available results when some repos return empty', async () => {
    const leads = makeLeadRepo()
    const contacts = makeContactRepo()
    const props = makePropertyRepo()
    leads.searchByName.mockResolvedValue([{ id: 'l1', full_name: 'Test Lead' }])
    contacts.searchByName.mockResolvedValue([])
    props.searchByAddress.mockResolvedValue([])

    const results = await new SearchEntitiesUseCase(leads, contacts, props).execute('org1', 'Test', 5)
    expect(results).toHaveLength(1)
    expect(results[0]?.type).toBe('lead')
  })
})
