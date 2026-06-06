import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1StageHistoryRepository } from '../../src/repositories/d1-stage-history-repository'

describe('D1StageHistoryRepository', () => {
  let env: TestEnv
  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  it('log() persists entry; findByEntity() returns entries ordered DESC by changed_at with populated changed_at', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const leadId = nextId('lead')
    const repo = new D1StageHistoryRepository(env.DB)

    await repo.log({ org_id: org.id, entity_type: 'lead', entity_id: leadId, from_stage: 'nuevo', to_stage: 'asignado', changed_by: user.id, notes: null })
    // Sleep 1100ms to guarantee a different second in datetime('now') — SQLite's resolution is 1s without fractional seconds.
    await new Promise(r => setTimeout(r, 1100))
    await repo.log({ org_id: org.id, entity_type: 'lead', entity_id: leadId, from_stage: 'asignado', to_stage: 'contactado', changed_by: user.id, notes: null })

    const entries = await repo.findByEntity('lead', leadId, org.id)
    expect(entries.length).toBe(2)
    expect(entries[0].to_stage).toBe('contactado')
    expect(entries[0].changed_at).toBeTruthy()
    expect(entries[1].to_stage).toBe('asignado')
    expect(entries[1].changed_at).toBeTruthy()
  })

  // Regression: in CI runners we observed the smoke read history[0] and get
  // the FIRST inserted row (instead of the last) when multiple transitions
  // landed in the same second. ORDER BY changed_at DESC alone is ambiguous
  // for ties; ORDER BY changed_at DESC, rowid DESC tiebreaks by insertion.
  it('orders ties by insertion (rowid) when changed_at lands in the same second', async () => {
    const org = await seedOrg(env.DB)
    const user = await seedUser(env.DB, org.id)
    const leadId = nextId('lead')
    const repo = new D1StageHistoryRepository(env.DB)

    // Fire 5 transitions back-to-back. Without rowid tiebreaker they would
    // be returned in undefined order; with it the latest comes first.
    const chain = ['asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada']
    let prev = 'nuevo'
    for (const next of chain) {
      await repo.log({
        org_id: org.id, entity_type: 'lead', entity_id: leadId,
        from_stage: prev, to_stage: next, changed_by: user.id, notes: null,
      })
      prev = next
    }

    const entries = await repo.findByEntity('lead', leadId, org.id)
    expect(entries.length).toBe(5)
    expect(entries[0].to_stage).toBe('presentada')
    expect(entries[entries.length - 1].to_stage).toBe('asignado')
  })
})
