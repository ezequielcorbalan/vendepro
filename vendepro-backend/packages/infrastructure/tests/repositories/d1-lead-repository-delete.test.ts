import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { Lead } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LeadRepository } from '../../src/repositories/d1-lead-repository'

/**
 * Cubre el fix del DELETE de leads: las FKs hacia leads(id) no tienen ON DELETE,
 * así que un borrado plano falla con "FOREIGN KEY constraint failed". El repo
 * limpia dependencias propias (eventos, actividades, tags) y desvincula entidades
 * de negocio (properties, appraisals -> lead_id NULL) antes de borrar el lead.
 */
describe('D1LeadRepository.delete — cascade & unlink', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
  })

  function buildLead(id: string) {
    return Lead.create({
      id, org_id: orgId, full_name: 'Lead Borrable',
      phone: null, email: null, source: 'manual', source_detail: null,
      property_address: null, neighborhood: null, property_type: null, operation: 'venta',
      stage: 'contactado', assigned_to: agentId, notes: null, estimated_value: null,
      budget: null, timing: null, personas_trabajo: null, mascotas: null,
      next_step: null, next_step_date: null, lost_reason: null,
      first_contact_at: null, contact_id: null,
    })
  }

  async function count(table: string, where: string, ...binds: unknown[]): Promise<number> {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).bind(...binds).first() as any
    return row.n as number
  }

  it('borra el lead y sus dependencias, y desvincula property/appraisal', async () => {
    const repo = new D1LeadRepository(env.DB)
    const leadId = nextId('lead')
    await repo.save(buildLead(leadId))

    // Dependencias propias del lead (deben borrarse).
    await env.DB.prepare(
      `INSERT INTO calendar_events (id, org_id, agent_id, title, event_type, lead_id) VALUES (?, ?, ?, 'Visita', 'visita_comprador', ?)`,
    ).bind(nextId('evt'), orgId, agentId, leadId).run()
    await env.DB.prepare(
      `INSERT INTO activities (id, org_id, agent_id, activity_type, lead_id) VALUES (?, ?, ?, 'llamada', ?)`,
    ).bind(nextId('act'), orgId, agentId, leadId).run()
    const tagId = nextId('tag')
    await env.DB.prepare(`INSERT INTO tags (id, org_id, name) VALUES (?, ?, 'Propietario')`).bind(tagId, orgId).run()
    await env.DB.prepare(`INSERT INTO lead_tags (lead_id, tag_id) VALUES (?, ?)`).bind(leadId, tagId).run()

    // Entidades de negocio (deben sobrevivir con lead_id NULL).
    const propId = nextId('prop')
    await env.DB.prepare(
      `INSERT INTO properties (id, org_id, address, neighborhood, owner_name, public_slug, agent_id, lead_id) VALUES (?, ?, 'Calle 1', 'Centro', 'Dueño', ?, ?, ?)`,
    ).bind(propId, orgId, nextId('slug'), agentId, leadId).run()
    const apprId = nextId('appr')
    await env.DB.prepare(
      `INSERT INTO appraisals (id, org_id, property_address, neighborhood, agent_id, lead_id) VALUES (?, ?, 'Calle 1', 'Centro', ?, ?)`,
    ).bind(apprId, orgId, agentId, leadId).run()

    // Acción: borrar el lead (no debe tirar FK constraint).
    await expect(repo.delete(leadId, orgId)).resolves.toBeUndefined()

    // Lead y dependencias propias: borrados.
    expect(await count('leads', 'id = ?', leadId)).toBe(0)
    expect(await count('calendar_events', 'lead_id = ?', leadId)).toBe(0)
    expect(await count('activities', 'lead_id = ?', leadId)).toBe(0)
    expect(await count('lead_tags', 'lead_id = ?', leadId)).toBe(0)

    // Property y appraisal: siguen existiendo, pero desvinculadas.
    expect(await count('properties', 'id = ?', propId)).toBe(1)
    expect(await count('appraisals', 'id = ?', apprId)).toBe(1)
    expect(await count('properties', 'id = ? AND lead_id IS NULL', propId)).toBe(1)
    expect(await count('appraisals', 'id = ? AND lead_id IS NULL', apprId)).toBe(1)
  })

  it('no toca dependencias de otros leads ni de otra org', async () => {
    const repo = new D1LeadRepository(env.DB)
    const target = nextId('lead')
    const other = nextId('lead')
    await repo.save(buildLead(target))
    await repo.save(buildLead(other))

    await env.DB.prepare(
      `INSERT INTO activities (id, org_id, agent_id, activity_type, lead_id) VALUES (?, ?, ?, 'llamada', ?)`,
    ).bind(nextId('act'), orgId, agentId, other).run()

    await repo.delete(target, orgId)

    expect(await count('leads', 'id = ?', other)).toBe(1)
    expect(await count('activities', 'lead_id = ?', other)).toBe(1)
  })
})
