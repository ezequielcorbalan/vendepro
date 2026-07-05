import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Lead } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LeadRepository } from '../../src/repositories/d1-lead-repository'

describe('D1LeadRepository — findOpenByContactAndSourceDetail', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string
  let contactId: string

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
    contactId = nextId('contact')
    await env.DB
      .prepare(`INSERT INTO contacts (id, org_id, full_name, contact_type, agent_id, created_at) VALUES (?, ?, 'Contacto Test', 'otro', ?, datetime('now'))`)
      .bind(contactId, orgId, agentId)
      .run()
  })

  function buildLead(overrides: Partial<Parameters<typeof Lead.create>[0]> = {}) {
    return Lead.create({
      id: nextId('lead'),
      org_id: orgId,
      full_name: 'Test Lead',
      phone: null, email: null, source: 'api', source_detail: null,
      property_address: null, neighborhood: null, property_type: null, operation: 'venta',
      stage: 'nuevo', assigned_to: agentId, notes: null, estimated_value: null,
      budget: null, timing: null, personas_trabajo: null, mascotas: null,
      next_step: null, next_step_date: null, lost_reason: null,
      first_contact_at: null, contact_id: contactId,
      ...overrides,
    })
  }

  it('encuentra el lead abierto del contacto con el mismo source_detail', async () => {
    const repo = new D1LeadRepository(env.DB)
    const lead = buildLead({ source_detail: 'zonaprop', stage: 'contactado' })
    await repo.save(lead)

    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(lead.id)
  })

  it('no matchea leads en etapas terminales (invalido/finalizado/perdido)', async () => {
    const repo = new D1LeadRepository(env.DB)
    for (const stage of ['invalido', 'finalizado', 'perdido'] as const) {
      await repo.save(buildLead({ source_detail: 'zonaprop', stage }))
    }
    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)
    expect(found).toBeNull()
  })

  it('captado cuenta como abierto (sigue en proceso hasta finalizado)', async () => {
    const repo = new D1LeadRepository(env.DB)
    const lead = buildLead({ source_detail: 'zonaprop', stage: 'captado' })
    await repo.save(lead)
    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(lead.id)
  })

  it('no matchea otro source_detail', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ source_detail: 'argenprop' }))
    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)
    expect(found).toBeNull()
  })

  it('source_detail NULL matchea leads con source_detail NULL', async () => {
    const repo = new D1LeadRepository(env.DB)
    const lead = buildLead({ source_detail: null })
    await repo.save(lead)

    const found = await repo.findOpenByContactAndSourceDetail(contactId, null, orgId)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(lead.id)
    // y NULL no matchea un source_detail concreto
    expect(await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)).toBeNull()
  })

  it('no cruza organizaciones', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ source_detail: 'zonaprop' }))
    const otherOrg = await seedOrg(env.DB)
    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', otherOrg.id)
    expect(found).toBeNull()
  })

  it('devuelve el más reciente si hay varios abiertos', async () => {
    const repo = new D1LeadRepository(env.DB)
    const older = buildLead({ source_detail: 'zonaprop', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = buildLead({ source_detail: 'zonaprop', created_at: '2026-06-01T00:00:00.000Z', updated_at: '2026-06-01T00:00:00.000Z' })
    await repo.save(older)
    await repo.save(newer)

    const found = await repo.findOpenByContactAndSourceDetail(contactId, 'zonaprop', orgId)
    expect(found!.id).toBe(newer.id)
  })

  it('no matchea leads de otro contacto', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ source_detail: 'zonaprop' }))
    const found = await repo.findOpenByContactAndSourceDetail('otro-contacto', 'zonaprop', orgId)
    expect(found).toBeNull()
  })
})
