import { describe, it, expect, vi } from 'vitest'
import { DeleteOrgVariableUseCase } from '../../../src/application/use-cases/org-variables/delete-org-variable'
import { OrgVariable } from '@vendepro/core'

describe('DeleteOrgVariableUseCase', () => {
  it('deletes a custom variable', async () => {
    const v = OrgVariable.create({ id: 'v1', org_id: 'o1', key: 'custom.x', value: '1', value_type: 'number', label: null, namespace: 'custom', is_system: false })
    const repo = { findById: vi.fn().mockResolvedValue(v), delete: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), resolveKeys: vi.fn() }
    const uc = new DeleteOrgVariableUseCase(repo as any)
    const r = await uc.execute({ id: 'v1', orgId: 'o1' })
    expect(r.deleted).toBe(true); expect(repo.delete).toHaveBeenCalledWith('v1')
  })

  it('refuses to delete a system variable', async () => {
    const sys = OrgVariable.create({ id: 'v2', org_id: 'o1', key: 'market.x', value: '1', value_type: 'number', label: null, namespace: 'market', is_system: true })
    const repo = { findById: vi.fn().mockResolvedValue(sys), delete: vi.fn(),
      findByKey: vi.fn(), listByOrg: vi.fn(), save: vi.fn(), resolveKeys: vi.fn() }
    const uc = new DeleteOrgVariableUseCase(repo as any)
    await expect(uc.execute({ id: 'v2', orgId: 'o1' })).rejects.toThrow(/sistema/i)
  })
})
