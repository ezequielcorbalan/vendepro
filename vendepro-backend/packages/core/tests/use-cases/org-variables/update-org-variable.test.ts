import { describe, it, expect, vi } from 'vitest'
import { UpdateOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/update-org-variable'
import { OrgVariable } from '@vendepro/core'

const v = OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'market.x', value: '1', value_type: 'number', label: null, namespace: 'market', is_system: true })

describe('UpdateOrgVariableUseCase', () => {
  it('updates value of system variable (allowed)', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(v), save: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), delete: vi.fn(), resolveKeys: vi.fn() }
    const uc = new UpdateOrgVariableUseCase(repo as any)
    const r = await uc.execute({ id: 'v1', orgId: 'o1', value: '2' })
    expect(r.updated).toBe(true)
  })
})
