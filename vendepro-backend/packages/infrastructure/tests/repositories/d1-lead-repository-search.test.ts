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
    const results = await repo.findPendingFollowups(orgId, now, 10, 'vendedor')
    expect(results.some(r => r.full_name === 'Overdue Lead')).toBe(true)
    expect(results.some(r => r.full_name === 'Future Lead')).toBe(false)
    // captado should be excluded
    expect(results.some(r => r.full_name === 'Captado Lead')).toBe(false)
  })

  // El bug que esto cubre: sin filtro de pipeline, un comprador con visita
  // pendiente aparecía en el dashboard de captación y sumaba a su contador.
  it('findPendingFollowups keeps each pipeline on its own board', async () => {
    const repo = new D1LeadRepository(env.DB)
    const pastDate = '2026-01-01T00:00:00.000Z'

    await repo.save(buildLead({ full_name: 'Propietario Pendiente', next_step_date: pastDate, stage: 'contactado', pipeline: 'vendedor' }))
    await repo.save(buildLead({ full_name: 'Comprador Pendiente', next_step_date: pastDate, stage: 'contactado', pipeline: 'comprador' }))

    const now = new Date().toISOString()

    const sellers = await repo.findPendingFollowups(orgId, now, 10, 'vendedor')
    expect(sellers.some(r => r.full_name === 'Propietario Pendiente')).toBe(true)
    expect(sellers.some(r => r.full_name === 'Comprador Pendiente')).toBe(false)

    const buyers = await repo.findPendingFollowups(orgId, now, 10, 'comprador')
    expect(buyers.some(r => r.full_name === 'Comprador Pendiente')).toBe(true)
    expect(buyers.some(r => r.full_name === 'Propietario Pendiente')).toBe(false)
  })

  // El buscador de la lista necesita encontrar un lead por la propiedad
  // vinculada (comprador que consultó por un aviso, vendedor ya captado) y por
  // el teléfono del contacto, que muchas veces no está copiado en el lead.
  it('findByOrg trae la propiedad vinculada y el teléfono del contacto', async () => {
    const repo = new D1LeadRepository(env.DB)
    const contactId = nextId('contact')
    await env.DB.prepare(`INSERT INTO contacts (id, org_id, agent_id, full_name, phone) VALUES (?,?,?,?,?)`)
      .bind(contactId, orgId, agentId, 'Dueño Test', '11-4321-8765').run()
    const lead = buildLead({ full_name: 'Comprador Test', contact_id: contactId, pipeline: 'comprador', stage: 'nuevo' })
    await repo.save(lead)

    const propId = nextId('prop')
    await env.DB.prepare(`
      INSERT INTO properties (id, org_id, address, neighborhood, owner_name, public_slug)
      VALUES (?,?,?,?,?,?)`)
      .bind(propId, orgId, 'Av. Cabildo 2040', 'Belgrano', 'Dueño Test', `slug-${propId}`).run()
    await env.DB.prepare(`
      INSERT INTO lead_properties (id, org_id, lead_id, property_id) VALUES (?,?,?,?)`)
      .bind(nextId('lp'), orgId, lead.id, propId).run()

    const rows = await repo.findByOrg(orgId, { pipeline: 'comprador' })
    const found = rows.find(r => r.id === lead.id)?.toObject()
    expect(found?.linked_properties).toContain('Av. Cabildo 2040')
    expect(found?.contact_phone).toBe('11-4321-8765')
  })

  it('findByOrg busca por teléfono sin importar cómo esté escrito', async () => {
    const repo = new D1LeadRepository(env.DB)
    await repo.save(buildLead({ full_name: 'Con Teléfono', phone: '+54 9 11 5555-1234' }))
    await repo.save(buildLead({ full_name: 'Otro', phone: '11 4444-9999' }))

    const rows = await repo.findByOrg(orgId, { search: '5555-1234' })
    expect(rows.map(r => r.full_name)).toEqual(['Con Teléfono'])
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
