import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from './helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from './helpers/fixtures'
import {
  CreateLandingFromTemplateUseCase,
  PublishLandingUseCase,
  GetPublicLandingUseCase,
  SubmitLeadFromLandingUseCase,
  LandingTemplate,
} from '@vendepro/core'
import {
  D1LandingRepository,
  D1LandingTemplateRepository,
  D1LandingVersionRepository,
  D1LandingEventRepository,
  D1LeadRepository,
  CryptoIdGenerator,
} from '@vendepro/infrastructure'

async function seedGlobalTemplate(db: D1Database) {
  const id = nextId('tpl')
  // Store blocks_json as bare array format (adapter handles both shapes).
  const blocks = [
    { id: 'b_h', type: 'hero', visible: true, data: { title: 'T', background_image_url: 'https://x/y.jpg', overlay_opacity: 0.5 } },
    { id: 'b_f', type: 'lead-form', visible: true, data: { title: 'C', fields: [{ key: 'name', label: 'N', required: true }, { key: 'phone', label: 'T', required: true }], submit_label: 'E', success_message: '¡Ok!' } },
  ]
  await db.prepare(`INSERT INTO landing_templates (id, org_id, name, kind, blocks_json, active, sort_order)
    VALUES (?, NULL, 'TplE2E', 'property', ?, 1, 1)`).bind(id, JSON.stringify(blocks)).run()
  return { id, blocks }
}

describe('landings e2e happy path', () => {
  let env: TestEnv
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { if (env) await closeTestDB(env) })

  it('create → publish → public view → submit → lead creado con source landing:<slug>', async () => {
    const org = await seedOrg(env.DB)
    const agent = await seedUser(env.DB, org.id, { role: 'agent' })
    const admin = await seedUser(env.DB, org.id, { role: 'admin' })
    const { id: tplId } = await seedGlobalTemplate(env.DB)

    const repos = {
      landings: new D1LandingRepository(env.DB),
      templates: new D1LandingTemplateRepository(env.DB),
      versions: new D1LandingVersionRepository(env.DB),
      events: new D1LandingEventRepository(env.DB),
      leads: new D1LeadRepository(env.DB),
      idGen: new CryptoIdGenerator(),
    }

    // 1. Create
    const { landingId, fullSlug } = await new CreateLandingFromTemplateUseCase(repos.templates, repos.landings, repos.versions, repos.idGen)
      .execute({ actor: { role: 'agent', userId: agent.id }, orgId: org.id, templateId: tplId, slugBase: 'e2e-smoke' })
    expect(landingId).toBeDefined()
    expect(fullSlug).toMatch(/^e2e-smoke-[a-z0-9]{5}$/)

    // 2. Transition to pending_review (simulating request-publish)
    const landing = await repos.landings.findById(landingId, org.id)
    expect(landing).not.toBeNull()
    await repos.landings.save(landing!.transitionStatus('pending_review'))

    // 3. Publish (admin)
    const { versionId } = await new PublishLandingUseCase(repos.landings, repos.versions, repos.idGen)
      .execute({ actor: { role: 'admin', userId: admin.id }, orgId: org.id, landingId })
    expect(versionId).toBeDefined()

    // 4. GET público
    const view = await new GetPublicLandingUseCase(repos.landings, repos.versions)
      .execute({ fullSlug })
    expect(view.blocks.length).toBeGreaterThan(0)
    expect(view.kind).toBe('property')

    // 5. Submit lead
    const submit = await new SubmitLeadFromLandingUseCase(repos.landings, repos.events, repos.leads, repos.idGen)
      .execute({ fullSlug, fields: { name: 'Juan Pérez', phone: '1122334455' } })
    expect(submit.leadId).toBeDefined()
    expect(submit.successMessage).toBe('¡Ok!')

    // 6. Verificar lead en DB con source correcto
    const rows = (await env.DB.prepare(`SELECT source FROM leads WHERE id = ?`).bind(submit.leadId).all()).results as any[]
    expect(rows[0]?.source).toBe(`landing:${fullSlug}`)
  }, 20000)
})
