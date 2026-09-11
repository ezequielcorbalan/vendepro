import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1LeadPropertyRepository } from '../../src/repositories/d1-lead-property-repository'

/**
 * El conteo que alimenta el bloque "Propiedades mostradas" de la pestaña de
 * compradores. Lo que hay que asegurar es el recorte: sólo compradores, sólo
 * la org, y —cuando se mira a un agente— sólo los suyos. Un conteo que se
 * pasa de largo en cualquiera de los tres ejes muestra trabajo ajeno.
 */
describe('D1LeadPropertyRepository — countBuyerStatusBreakdown', () => {
  let env: TestEnv

  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  async function seedLead(
    orgId: string, pipeline: string, assignedTo: string | null, id = nextId('lead'),
  ) {
    await env.DB.prepare(
      `INSERT INTO leads (id, org_id, full_name, stage, pipeline, source, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, datetime('now'), datetime('now'))`,
    ).bind(id, orgId, `Lead ${id}`, 'nuevo', pipeline, assignedTo).run()
    return id
  }

  async function seedProperty(orgId: string, id = nextId('prop')) {
    await env.DB.prepare(
      `INSERT INTO properties (id, org_id, address, neighborhood, owner_name, public_slug, created_at, updated_at)
       VALUES (?, ?, ?, 'Palermo', 'Propietario', ?, datetime('now'), datetime('now'))`,
    ).bind(id, orgId, `Calle ${id}`, id).run()
    return id
  }

  async function link(orgId: string, leadId: string, propertyId: string, status: string) {
    await env.DB.prepare(
      `INSERT INTO lead_properties (id, org_id, lead_id, property_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    ).bind(nextId('lp'), orgId, leadId, propertyId, status).run()
  }

  it('agrupa por estado sólo las propiedades de leads compradores', async () => {
    const repo = new D1LeadPropertyRepository(env.DB)
    const org = await seedOrg(env.DB)
    const comprador = await seedLead(org.id, 'comprador', null)
    const vendedor = await seedLead(org.id, 'vendedor', null)

    await link(org.id, comprador, await seedProperty(org.id), 'visitada')
    await link(org.id, comprador, await seedProperty(org.id), 'visitada')
    await link(org.id, comprador, await seedProperty(org.id), 'oferto')
    // Del lado vendedor la relación también existe (un propietario puede
    // mirar otras propiedades), pero no es trabajo de compradores.
    await link(org.id, vendedor, await seedProperty(org.id), 'visitada')

    expect(await repo.countBuyerStatusBreakdown(org.id)).toEqual({ visitada: 2, oferto: 1 })
  })

  it('no cuenta las propiedades de otra inmobiliaria', async () => {
    const repo = new D1LeadPropertyRepository(env.DB)
    const mia = await seedOrg(env.DB)
    const ajena = await seedOrg(env.DB)
    await link(ajena.id, await seedLead(ajena.id, 'comprador', null), await seedProperty(ajena.id), 'visitada')

    expect(await repo.countBuyerStatusBreakdown(mia.id)).toEqual({})
  })

  it('con agente, cuenta sólo los compradores de ese agente', async () => {
    const repo = new D1LeadPropertyRepository(env.DB)
    const org = await seedOrg(env.DB)
    const mio = await seedUser(env.DB, org.id)
    const otro = await seedUser(env.DB, org.id)

    await link(org.id, await seedLead(org.id, 'comprador', mio.id), await seedProperty(org.id), 'interesado')
    await link(org.id, await seedLead(org.id, 'comprador', otro.id), await seedProperty(org.id), 'interesado')

    expect(await repo.countBuyerStatusBreakdown(org.id, mio.id)).toEqual({ interesado: 1 })
  })

  it('un lead viejo sin pipeline cuenta como vendedor, no como comprador', async () => {
    // `pipeline` se agregó después: las filas anteriores lo tienen NULL y son
    // todas de captación. Sin el COALESCE se colarían en el conteo comprador.
    const repo = new D1LeadPropertyRepository(env.DB)
    const org = await seedOrg(env.DB)
    const viejo = nextId('lead')
    await env.DB.prepare(
      `INSERT INTO leads (id, org_id, full_name, stage, source, created_at, updated_at)
       VALUES (?, ?, 'Lead viejo', 'nuevo', 'manual', datetime('now'), datetime('now'))`,
    ).bind(viejo, org.id).run()
    await link(org.id, viejo, await seedProperty(org.id), 'visitada')

    expect(await repo.countBuyerStatusBreakdown(org.id)).toEqual({})
  })

  it('sin compradores devuelve un mapa vacío, no un error', async () => {
    const repo = new D1LeadPropertyRepository(env.DB)
    const org = await seedOrg(env.DB)

    expect(await repo.countBuyerStatusBreakdown(org.id)).toEqual({})
  })
})
