import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1TimeBasedCandidateRepository } from '../../src/repositories/d1-time-based-candidate-repository'

const NOW = new Date('2026-09-10T12:00:00Z')
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString()
const HOURS = 3_600_000
const DAYS = 86_400_000

async function seedLead(
  db: D1Database,
  orgId: string,
  overrides: Partial<{ id: string; stage: string; created_at: string }> = {},
) {
  const id = overrides.id ?? nextId('lead')
  await db
    .prepare(`INSERT INTO leads (id, org_id, full_name, stage, created_at) VALUES (?, ?, 'Lead Test', ?, ?)`)
    .bind(id, orgId, overrides.stage ?? 'nuevo', overrides.created_at ?? iso(0))
    .run()
  return id
}

async function seedRun(db: D1Database, orgId: string, automationId: string, entityId: string, skipReason: string | null = null) {
  await db
    .prepare(`INSERT INTO automation_runs (id, org_id, automation_id, trigger_event, entity_type, entity_id, status, skip_reason)
              VALUES (?, ?, ?, 'lead.sin_contacto_24h', 'lead', ?, 'success', ?)`)
    .bind(nextId('run'), orgId, automationId, entityId, skipReason)
    .run()
}

describe('D1TimeBasedCandidateRepository', () => {
  let env: TestEnv
  beforeAll(async () => {
    env = await createTestDB()
  })
  afterAll(async () => {
    await closeTestDB(env)
  })

  it('findLeadsWithoutContact: solo etapas nuevo/asignado más viejas que el corte, sin run previo', async () => {
    const org = await seedOrg(env.DB)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const viejo = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(30 * HOURS) })
    const asignadoViejo = await seedLead(env.DB, org.id, { stage: 'asignado', created_at: iso(48 * HOURS) })
    await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(2 * HOURS) })        // reciente
    await seedLead(env.DB, org.id, { stage: 'contactado', created_at: iso(90 * HOURS) })  // ya contactado
    const conRun = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(70 * HOURS) })
    await seedRun(env.DB, org.id, 'auto-sla', conRun)

    const ids = await repo.findLeadsWithoutContact(org.id, 'auto-sla', null, 24, NOW, 50)
    // Orden: más viejos primero.
    expect(ids).toEqual([asignadoViejo, viejo])
  })

  it('findLeadsWithoutContact: un run salteado por rate_limited NO excluye (reintenta)', async () => {
    const org = await seedOrg(env.DB)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const lead = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(30 * HOURS) })
    await seedRun(env.DB, org.id, 'auto-sla', lead, 'rate_limited')

    const ids = await repo.findLeadsWithoutContact(org.id, 'auto-sla', null, 24, NOW, 50)
    expect(ids).toEqual([lead])
  })

  it('findLeadsWithoutContact: con notRunSince, un run de AYER no excluye pero uno de HOY sí (scope daily)', async () => {
    const org = await seedOrg(env.DB)
    const repo = new D1TimeBasedCandidateRepository(env.DB)
    const hoyUtc = '2026-09-10T00:00:00.000Z'

    const corridoAyer = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(80 * HOURS) })
    await env.DB
      .prepare(`INSERT INTO automation_runs (id, org_id, automation_id, trigger_event, entity_type, entity_id, status, created_at)
                VALUES (?, ?, 'auto-daily', 'lead.sin_contacto_24h', 'lead', ?, 'success', ?)`)
      .bind(nextId('run'), org.id, corridoAyer, '2026-09-09 15:00:00')
      .run()

    const corridoHoy = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(70 * HOURS) })
    await env.DB
      .prepare(`INSERT INTO automation_runs (id, org_id, automation_id, trigger_event, entity_type, entity_id, status, created_at)
                VALUES (?, ?, 'auto-daily', 'lead.sin_contacto_24h', 'lead', ?, 'success', ?)`)
      .bind(nextId('run'), org.id, corridoHoy, '2026-09-10 09:00:00')
      .run()

    const ids = await repo.findLeadsWithoutContact(org.id, 'auto-daily', hoyUtc, 24, NOW, 50)
    // El de ayer vuelve a ser candidato; el de hoy queda excluido hasta mañana.
    // (El run de hoy usa formato datetime('now') sin 'T': la normalización
    // datetime() lo compara bien igual.)
    expect(ids).toEqual([corridoAyer])
  })

  it('findLeadsWithoutContact: no cruza orgs y respeta el límite', async () => {
    const org = await seedOrg(env.DB)
    const otra = await seedOrg(env.DB)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const a = await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(50 * HOURS) })
    await seedLead(env.DB, org.id, { stage: 'nuevo', created_at: iso(40 * HOURS) })
    await seedLead(env.DB, otra.id, { stage: 'nuevo', created_at: iso(60 * HOURS) })

    const ids = await repo.findLeadsWithoutContact(org.id, 'auto-x', null, 24, NOW, 1)
    expect(ids).toEqual([a])
  })

  it('findLeadsWithoutActivity: excluye cerrados y leads con actividad reciente', async () => {
    const org = await seedOrg(env.DB)
    const agent = await seedUser(env.DB, org.id)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const frio = await seedLead(env.DB, org.id, { stage: 'seguimiento', created_at: iso(20 * DAYS) })
    await seedLead(env.DB, org.id, { stage: 'captado', created_at: iso(30 * DAYS) })  // cerrado
    await seedLead(env.DB, org.id, { stage: 'perdido', created_at: iso(30 * DAYS) })  // cerrado
    await seedLead(env.DB, org.id, { stage: 'contactado', created_at: iso(3 * DAYS) }) // muy nuevo

    const activo = await seedLead(env.DB, org.id, { stage: 'contactado', created_at: iso(20 * DAYS) })
    await env.DB
      .prepare(`INSERT INTO activities (id, org_id, agent_id, activity_type, lead_id, created_at) VALUES (?, ?, ?, 'llamada', ?, ?)`)
      .bind(nextId('act'), org.id, agent.id, activo, iso(1 * DAYS))
      .run()

    const ids = await repo.findLeadsWithoutActivity(org.id, 'auto-frio', null, 7, NOW, 50)
    expect(ids).toEqual([frio])
  })

  it('findLeadsWithoutActivity: una actividad vieja no salva al lead', async () => {
    const org = await seedOrg(env.DB)
    const agent = await seedUser(env.DB, org.id)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const lead = await seedLead(env.DB, org.id, { stage: 'contactado', created_at: iso(20 * DAYS) })
    await env.DB
      .prepare(`INSERT INTO activities (id, org_id, agent_id, activity_type, lead_id, created_at) VALUES (?, ?, ?, 'llamada', ?, ?)`)
      .bind(nextId('act'), org.id, agent.id, lead, iso(10 * DAYS))
      .run()

    const ids = await repo.findLeadsWithoutActivity(org.id, 'auto-frio', null, 7, NOW, 50)
    expect(ids).toEqual([lead])
  })

  it('findPropertiesWithExpiringAuthorization: ventana de vencimiento del mandato', async () => {
    const org = await seedOrg(env.DB)
    const repo = new D1TimeBasedCandidateRepository(env.DB)

    const insertProp = async (authStart: string | null, durationDays: number | null, status = 'active') => {
      const id = nextId('prop')
      await env.DB
        .prepare(`INSERT INTO properties (id, org_id, address, neighborhood, owner_name, public_slug, status, auth_start_date, auth_duration_days)
                  VALUES (?, ?, 'Calle 123', 'Barrio', 'Dueño', ?, ?, ?, ?)`)
        .bind(id, org.id, `slug-${id}`, status, authStart, durationDays)
        .run()
      return id
    }

    // Mandato de 180 días que arrancó hace 175 → vence en 5 días: entra con dias_antes=7.
    const porVencer = await insertProp(iso(175 * DAYS).slice(0, 10), 180)
    // Vence en 60 días: fuera de la ventana.
    await insertProp(iso(120 * DAYS).slice(0, 10), 180)
    // Ya vencido hace 10 días: fuera (la ventana arranca hoy).
    await insertProp(iso(190 * DAYS).slice(0, 10), 180)
    // Sin mandato cargado: fuera.
    await insertProp(null, null)
    // Por vencer pero vendida: fuera.
    await insertProp(iso(175 * DAYS).slice(0, 10), 180, 'sold')

    const ids = await repo.findPropertiesWithExpiringAuthorization(org.id, 'auto-venc', null, 7, NOW, 50)
    expect(ids).toEqual([porVencer])
  })
})
