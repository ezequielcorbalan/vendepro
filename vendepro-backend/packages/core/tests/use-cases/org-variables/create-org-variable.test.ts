import { describe, it, expect, vi } from 'vitest'
import { CreateOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/create-org-variable'

describe('CreateOrgVariableUseCase', () => {
  it('creates a custom variable', async () => {
    const repo = { save: vi.fn().mockResolvedValue(undefined), findByKey: vi.fn().mockResolvedValue(null),
      findById: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('v-new') }
    const uc = new CreateOrgVariableUseCase(repo as any, idGen)
    const r = await uc.execute({ orgId: 'o1', key: 'custom.award_count', value: '12', value_type: 'number', label: 'Premios', namespace: 'custom' })
    expect(r.id).toBe('v-new'); expect(repo.save).toHaveBeenCalled()
  })

  it('rejects duplicate key in same org', async () => {
    const repo = { save: vi.fn(), findByKey: vi.fn().mockResolvedValue({ id: 'x' }),
      findById: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const idGen = { generate: vi.fn().mockReturnValue('v-new') }
    const uc = new CreateOrgVariableUseCase(repo as any, idGen)
    await expect(uc.execute({ orgId: 'o1', key: 'custom.x', value: '1', value_type: 'number', label: null, namespace: 'custom' })).rejects.toThrow(/existe/i)
  })
})
