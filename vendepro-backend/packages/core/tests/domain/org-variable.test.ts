import { describe, it, expect } from 'vitest'
import { OrgVariable } from '../../src/domain/entities/org-variable'

describe('OrgVariable', () => {
  it('creates a system variable in market namespace', () => {
    const v = OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'market.properties_on_sale',
      value: '111294', value_type: 'number', label: 'Propiedades en venta',
      namespace: 'market', is_system: true,
    })
    expect(v.key).toBe('market.properties_on_sale'); expect(v.isSystem()).toBe(true)
  })

  it('derives namespace from key if not provided explicitly', () => {
    const v = OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'custom.award_count', value: '12',
      value_type: 'number', label: null, namespace: 'custom', is_system: false,
    })
    expect(v.namespace).toBe('custom')
  })

  it('rejects invalid key (spaces/symbols)', () => {
    expect(() => OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'bad key!', value: '0', value_type: 'number',
      label: null, namespace: 'custom', is_system: false,
    })).toThrow(/key/)
  })

  it('rejects unknown value_type', () => {
    expect(() => OrgVariable.create({
      id: 'v1', org_id: 'o1', key: 'custom.x', value: '1',
      value_type: 'json' as any, label: null, namespace: 'custom', is_system: false,
    })).toThrow(/value_type/)
  })
})
