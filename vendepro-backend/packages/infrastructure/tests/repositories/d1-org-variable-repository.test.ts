import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1OrgVariableRepository } from '../../src/repositories/d1-org-variable-repository'
import { OrgVariable } from '@vendepro/core'

const MIG = `CREATE TABLE org_variables (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
  value_type TEXT NOT NULL, label TEXT, namespace TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(org_id, key));`

describe('D1OrgVariableRepository', () => {
  let db: D1Database; let repo: D1OrgVariableRepository
  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB'); await db.prepare(MIG).run()
    repo = new D1OrgVariableRepository(db)
  })

  const make = (o: any) => OrgVariable.create({
    id: o.id, org_id: o.org_id ?? 'o1', key: o.key,
    value: o.value ?? '0', value_type: o.value_type ?? 'number',
    label: o.label ?? null, namespace: o.namespace ?? 'market', is_system: o.is_system ?? false,
  })

  it('saves and finds by key', async () => {
    await repo.save(make({ id: 'v1', key: 'market.properties_on_sale', value: '111294' }))
    const found = await repo.findByKey('o1', 'market.properties_on_sale')
    expect(found?.value).toBe('111294')
  })

  it('enforces unique (org_id, key) via upsert', async () => {
    await repo.save(make({ id: 'v1', key: 'market.x', value: '1' }))
    await repo.save(make({ id: 'v1', key: 'market.x', value: '2' }))
    const f = await repo.findByKey('o1', 'market.x')
    expect(f?.value).toBe('2')
  })

  it('listByOrg filters by namespace', async () => {
    await repo.save(make({ id: 'v1', key: 'market.a', namespace: 'market' }))
    await repo.save(make({ id: 'v2', key: 'notary.b', namespace: 'notary' }))
    const list = await repo.listByOrg('o1', 'market')
    expect(list.map(v => v.key)).toEqual(['market.a'])
  })

  it('resolveKeys returns map for existing keys only', async () => {
    await repo.save(make({ id: 'v1', key: 'market.a' }))
    const map = await repo.resolveKeys('o1', ['market.a', 'market.missing'])
    expect(Object.keys(map)).toEqual(['market.a'])
  })
})
