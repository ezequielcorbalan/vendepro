import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1AppraisalTemplateRepository } from '../../src/repositories/d1-appraisal-template-repository'
import { AppraisalTemplate } from '@vendepro/core'

const MIGRATION_INIT = `
CREATE TABLE appraisal_templates (
  id TEXT PRIMARY KEY, org_id TEXT, kind TEXT, name TEXT, description TEXT,
  preview_image_url TEXT, blocks_json TEXT, is_system INTEGER DEFAULT 0,
  parent_template_id TEXT, active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT
);
`

describe('D1AppraisalTemplateRepository', () => {
  let db: D1Database
  let repo: D1AppraisalTemplateRepository

  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB')
    await db.prepare(MIGRATION_INIT).run()
    repo = new D1AppraisalTemplateRepository(db)
  })

  const validBlock = { id: 'b1', type: 'cover', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { title: 'T' } }
  const makeTemplate = (overrides: any = {}) => AppraisalTemplate.create({
    id: 't1', org_id: 'o1', kind: 'casa', name: 'Test',
    description: null, preview_image_url: null, blocks: [validBlock] as any,
    is_system: false, parent_template_id: null, active: true, sort_order: 0,
    ...overrides,
  })

  it('saves and finds by id', async () => {
    await repo.save(makeTemplate())
    const found = await repo.findById('t1')
    expect(found?.id).toBe('t1'); expect(found?.blocks.length).toBe(1)
  })

  it('listVisibleTo returns org templates + globals', async () => {
    await repo.save(makeTemplate({ id: 't-glob', org_id: null, is_system: true }))
    await repo.save(makeTemplate({ id: 't-org', org_id: 'o1' }))
    await repo.save(makeTemplate({ id: 't-other', org_id: 'o2' }))
    const list = await repo.listVisibleTo('o1')
    expect(list.map(t => t.id).sort()).toEqual(['t-glob', 't-org'])
  })

  it('countUsingTemplate returns 0 when no appraisals table exists', async () => {
    const n = await repo.countUsingTemplate('t1')
    expect(n).toBe(0)
  })
})
