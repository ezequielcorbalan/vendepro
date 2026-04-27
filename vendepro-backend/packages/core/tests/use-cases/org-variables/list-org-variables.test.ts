import { describe, it, expect, vi } from 'vitest'
import { ListOrgVariablesUseCase } from '../../../src/application/use-cases/org-variables/list-org-variables'

describe('ListOrgVariablesUseCase', () => {
  it('lists variables for an org, optionally filtered by namespace', async () => {
    const repo = { listByOrg: vi.fn().mockResolvedValue([{ toObject: () => ({ key: 'market.a' }) }]),
      findById: vi.fn(), findByKey: vi.fn(), save: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const uc = new ListOrgVariablesUseCase(repo as any)
    const r = await uc.execute({ orgId: 'o1', namespace: 'market' })
    expect(r.length).toBe(1); expect(repo.listByOrg).toHaveBeenCalledWith('o1', 'market')
  })
})
