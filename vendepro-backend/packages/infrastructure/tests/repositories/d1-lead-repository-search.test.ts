import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Lead } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LeadRepository } from '../../src/repositories/d1-lead-repository'

describe('D1LeadRepository — new methods', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

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
  })

  function buildLead(overrides: Partial<Parameters<typeof Lead.create>[0]> = {}) {
    return Lead.create({
      id: nextId('lead'),
      org_id: orgId,
      full_name: 'Test Lead',
      phone: null, email: null, source: 'manual', source_detail: null,
      property_address: null, neighborhood: null, property_type: null, operation: 'venta',
      stage: 'contactado', assigned_to: agentId, notes: null, estimated_value: null,
      budget: null, timing: null, personas_trabajo: null, mascotas: null,
      next_step: null, next_step_date: null, lost_reason: null,
      first_contact_at: null, contact_id: null,
      ...overrides,
    })
  }

  it('searchByName returns matching leads', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ full_name: 'Ana García' }))
    await repo.save(buildLead({ full_name: 'Luis Mora' }))

    const results = await repo.searchByName(orgId, 'Ana', 5)
    expect(results).toHaveLength(1)
    expect(results[0]?.full_name).toBe('Ana García')
  })

  it('searchByName respects limit', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ full_name: 'Beatriz X' }))
    await repo.save(buildLead({ full_name: 'Beatriz Y' }))
    await repo.save(buildLead({ full_name: 'Beatriz Z' }))

    const results = await repo.searchByName(orgId, 'Beatriz', 2)
    expect(results).toHaveLength(2)
  })

  it('findPendingFollowups returns overdue leads', async () => {
    const repo = new D1LeadRepository(env.DB)
    const pastDate = '2026-01-01T00:00:00.000Z'
    const futureDate = '2030-01-01T00:00:00.000Z'

    await repo.save(buildLead({ full_name: 'Overdue Lead', next_step_date: pastDate, stage: 'contactado' }))
    await repo.save(buildLead({ full_name: 'Future Lead', next_step_date: futureDate, stage: 'contactado' }))
    await repo.save(buildLead({ full_name: 'Captado Lead', next_step_date: pastDate, stage: 'captado' }))

    const now = new Date().toISOString()
    const results = await repo.findPendingFollowups(orgId, now, 10)
    expect(results.some(r => r.full_name === 'Overdue Lead')).toBe(true)
    expect(results.some(r => r.full_name === 'Future Lead')).toBe(false)
    // captado should be excluded
    expect(results.some(r => r.full_name === 'Captado Lead')).toBe(false)
  })

  it('exportAllWithAssignedName returns rows with assigned_name', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ full_name: 'Export Lead', assigned_to: agentId }))

    const rows = await repo.exportAllWithAssignedName(orgId)
    expect(rows.length).toBeGreaterThan(0)
    const row = rows.find(r => (r as any).full_name === 'Export Lead')
    expect(row).toBeDefined()
    // assigned_name comes from JOIN
    expect((row as any).assigned_name).toBe('Test User')
  })
})
