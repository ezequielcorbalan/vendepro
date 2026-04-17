import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Appraisal } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1AppraisalRepository } from '../../src/repositories/d1-appraisal-repository'

describe('D1AppraisalRepository — count methods', () => {
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

  function buildAppraisal(overrides: Partial<Parameters<typeof Appraisal.create>[0]> = {}) {
    return Appraisal.create({
      id: nextId('app'),
      org_id: orgId,
      property_address: 'Av. Test 1',
      neighborhood: 'Palermo',
      city: 'Buenos Aires',
      property_type: 'departamento',
      covered_area: null, total_area: null, semi_area: null, weighted_area: null,
      strengths: null, weaknesses: null, opportunities: null, threats: null,
      publication_analysis: null, suggested_price: null, test_price: null,
      expected_close_price: null, usd_per_m2: null, canva_design_id: null, canva_edit_url: null,
      agent_id: agentId, lead_id: null, status: 'draft', public_slug: null,
      ...overrides,
    })
  }

  it('countByOrg returns total appraisals for the org', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    await repo.save(buildAppraisal())
    await repo.save(buildAppraisal())

    const count = await repo.countByOrg(orgId)
    expect(count).toBe(2)
  })

  it('countByOrgAndStage returns 0 for non-existent status value', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    await repo.save(buildAppraisal({ status: 'draft' }))
    // 'captado' is not a valid status per schema (draft/generated/sent) → always 0
    const count = await repo.countByOrgAndStage(orgId, 'captado')
    expect(count).toBe(0)
  })

  it('countByOrgAndStage returns correct count for valid status', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    await repo.save(buildAppraisal({ status: 'generated' }))
    await repo.save(buildAppraisal({ status: 'draft' }))

    const count = await repo.countByOrgAndStage(orgId, 'generated')
    expect(count).toBe(1)
  })

  it('countByAgent returns only that agent\'s appraisals', async () => {
    const repo = new D1AppraisalRepository(env.DB)
    const otherUser = await seedUser(env.DB, orgId)

    await repo.save(buildAppraisal({ agent_id: agentId }))
    await repo.save(buildAppraisal({ agent_id: otherUser.id }))

    const count = await repo.countByAgent(orgId, agentId)
    expect(count).toBe(1)
  })
})
