import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LandingRepository } from '../../src/repositories/d1-landing-repository'
import { Landing } from '@vendepro/core'

async function seedTemplate(db: D1Database, id: string) {
  const blocks = [
    { id: 'b_h', type: 'hero', visible: true, data: { title: 'T', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
    { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'c', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } },
  ]
  await db.prepare(`INSERT INTO landing_templates (id, org_id, name, kind, blocks_json, active, sort_order)
    VALUES (?, NULL, 'T', 'property', ?, 1, 1)`).bind(id, JSON.stringify({ blocks })).run()
}

const HERO = { id: 'b_h', type: 'hero' as const, visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
const FORM = { id: 'b_f', type: 'lead-form' as const, visible: true, data: { title: 'c', fields: [{ key: 'name' as const, label: 'N', required: true }, { key: 'phone' as const, label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } }

describe('D1LandingRepository', () => {
  let env: TestEnv
  let repo: D1LandingRepository

  beforeEach(async () => {
    env = await createTestDB()
    repo = new D1LandingRepository(env.DB)
  })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('save + findById round-trip', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const l = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks: [HERO, FORM] })
    await repo.save(l)
    const loaded = await repo.findById(l.id, org.id)
    expect(loaded?.full_slug).toBe('pal-abc23')
    expect(loaded?.blocks.length).toBe(2)
  })

  it('existsFullSlug retorna true cuando existe', async () => {
    const org = await seedOrg(env.DB); const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const l = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'xyz', slug_suffix: 'aaaaa', blocks: [HERO, FORM] })
    await repo.save(l)
    expect(await repo.existsFullSlug('xyz-aaaaa')).toBe(true)
    expect(await repo.existsFullSlug('nope-aaaaa')).toBe(false)
  })

  it('findByOrg filtra por status', async () => {
    const org = await seedOrg(env.DB); const user = await seedUser(env.DB, org.id)
    const tplId = nextId('tpl'); await seedTemplate(env.DB, tplId)
    const draft = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'aaa', slug_suffix: 'bbbbb', blocks: [HERO, FORM] })
    const review = Landing.create({ id: nextId('l'), org_id: org.id, agent_id: user.id, template_id: tplId, kind: 'property', slug_base: 'bbb', slug_suffix: 'ccccc', blocks: [HERO, FORM] }).transitionStatus('pending_review')
    await repo.save(draft); await repo.save(review)
    const pend = await repo.findByOrg(org.id, { status: 'pending_review' })
    expect(pend.length).toBe(1)
    expect(pend[0].full_slug).toBe('bbb-ccccc')
  })
})
