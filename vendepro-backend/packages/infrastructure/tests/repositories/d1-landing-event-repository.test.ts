import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LandingEventRepository } from '../../src/repositories/d1-landing-event-repository'
import { D1LandingRepository } from '../../src/repositories/d1-landing-repository'
import { Landing, LandingEvent } from '@vendepro/core'

const HERO = { id: 'b_h', type: 'hero' as const, visible: true, data: { title: 't', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } }
const FORM = { id: 'b_f', type: 'lead-form' as const, visible: true, data: { title: 'c', fields: [{ key: 'name' as const, label: 'N', required: true }, { key: 'phone' as const, label: 'T', required: true }], submit_label: 'E', success_message: 'ok' } }

async function seedLanding(db: D1Database, orgId: string, agentId: string): Promise<string> {
  const tplId = nextId('tpl')
  const blocks = [HERO, FORM]
  await db.prepare(`INSERT INTO landing_templates (id, org_id, name, kind, blocks_json, active, sort_order)
    VALUES (?, NULL, 'T', 'property', ?, 1, 1)`).bind(tplId, JSON.stringify({ blocks })).run()
  const landingId = nextId('land')
  const landing = Landing.create({ id: landingId, org_id: orgId, agent_id: agentId, template_id: tplId, kind: 'property', slug_base: 'pal', slug_suffix: 'abc23', blocks: [HERO, FORM] })
  const landingRepo = new D1LandingRepository(db)
  await landingRepo.save(landing)
  return landingId
}

function mkEvent(landingId: string, slug: string, type: any, overrides: Partial<any> = {}) {
  return LandingEvent.create({
    id: `e_${Math.random().toString(36).slice(2)}`,
    landing_id: landingId,
    slug,
    event_type: type,
    visitor_id: overrides.visitor_id ?? 'v1',
    session_id: null,
    utm_source: overrides.utm_source ?? null,
    utm_medium: null, utm_campaign: null,
    referrer: null, user_agent: null,
  })
}

describe('D1LandingEventRepository', () => {
  let env: TestEnv
  let repo: D1LandingEventRepository
  let landingId: string

  beforeEach(async () => {
    env = await createTestDB()
    repo = new D1LandingEventRepository(env.DB)
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    landingId = await seedLanding(env.DB, org.id, user.id)
  })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('summary cuenta por tipo y únicos', async () => {
    await repo.save(mkEvent(landingId, 'pal-abc23', 'pageview', { visitor_id: 'v1' }))
    await repo.save(mkEvent(landingId, 'pal-abc23', 'pageview', { visitor_id: 'v1' }))
    await repo.save(mkEvent(landingId, 'pal-abc23', 'pageview', { visitor_id: 'v2' }))
    await repo.save(mkEvent(landingId, 'pal-abc23', 'form_submit', { visitor_id: 'v1' }))

    const s = await repo.summary(landingId, { since: '2000-01-01', until: '2099-01-01' })
    expect(s.pageviews).toBe(3)
    expect(s.unique_visitors).toBe(2)
    expect(s.form_submits).toBe(1)
  })

  it('topUtm agrupa correctamente', async () => {
    await repo.save(mkEvent(landingId, 'x', 'pageview', { utm_source: 'ig' }))
    await repo.save(mkEvent(landingId, 'x', 'pageview', { utm_source: 'ig' }))
    await repo.save(mkEvent(landingId, 'x', 'pageview', { utm_source: 'wa' }))
    const s = await repo.summary(landingId, { since: '2000-01-01', until: '2099-01-01' })
    expect(s.top_utm_sources[0]).toEqual({ source: 'ig', count: 2 })
  })
})
