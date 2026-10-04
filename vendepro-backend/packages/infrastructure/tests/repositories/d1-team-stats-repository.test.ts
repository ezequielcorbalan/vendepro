import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1TeamStatsRepository } from '../../src/repositories/d1-team-stats-repository'

describe('D1TeamStatsRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => { env = await createTestDB() })
  afterAll(async () => { await closeTestDB(env) })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    agentId = (await seedUser(env.DB, orgId)).id
  })

  /** `createdAt`/`updatedAt` crudos: los tests necesitan controlar el formato. */
  async function insertLead(opts: {
    stage: string
    assignedTo?: string | null
    createdAt?: string
    updatedAt?: string
    pipeline?: string | null
    firstContactAt?: string | null
  }) {
    const now = new Date().toISOString()
    await env.DB.prepare(`
      INSERT INTO leads (id, org_id, full_name, stage, assigned_to, pipeline, created_at, updated_at, first_contact_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(
        nextId('lead'), orgId, 'Lead Test', opts.stage,
        opts.assignedTo === undefined ? agentId : opts.assignedTo,
        opts.pipeline === undefined ? 'vendedor' : opts.pipeline,
        opts.createdAt ?? now, opts.updatedAt ?? now,
        opts.firstContactAt ?? null,
      ).run()
  }

  /** `created_at` hace N días y primer contacto H horas después. */
  async function leadContactadoEn(dias: number, horas: number, stage = 'contactado') {
    const creado = new Date(Date.now() - dias * 86400000)
    const contacto = new Date(creado.getTime() + horas * 3600000)
    await insertLead({ stage, createdAt: creado.toISOString(), firstContactAt: contacto.toISOString() })
  }

  const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString()
  /** Formato legacy de `datetime('now')`: sin T ni Z. */
  const daysAgoLegacy = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 19).replace('T', ' ')

  it('cuenta por etapa y total por agente', async () => {
    await insertLead({ stage: 'nuevo' })
    await insertLead({ stage: 'nuevo' })
    await insertLead({ stage: 'captado' })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.agent_id).toBe(agentId)
    expect(agg?.total).toBe(3)
    expect(agg?.by_stage).toEqual({ nuevo: 2, captado: 1 })
  })

  it('marca como sin contactar los `nuevo` de más de 24h, no los de hoy', async () => {
    await insertLead({ stage: 'nuevo', createdAt: daysAgoIso(3) })
    await insertLead({ stage: 'nuevo' })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.sin_contactar_24h).toBe(1)
  })

  // El bug que esto cubre: en la base conviven fechas ISO ('...T...Z') y el
  // formato de datetime('now') ('YYYY-MM-DD HH:MM:SS'). Comparando strings,
  // los leads viejos en formato legacy no se contaban como atrasados.
  it('entiende los dos formatos de fecha que conviven en la base', async () => {
    await insertLead({ stage: 'nuevo', createdAt: daysAgoLegacy(5), updatedAt: daysAgoLegacy(5) })
    await insertLead({ stage: 'nuevo', createdAt: daysAgoIso(5), updatedAt: daysAgoIso(5) })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.sin_contactar_24h).toBe(2)
    expect(agg?.sin_movimiento_7d).toBe(0)
  })

  it('cuenta sin movimiento después de 7 días', async () => {
    await insertLead({ stage: 'contactado', updatedAt: daysAgoIso(10) })
    await insertLead({ stage: 'contactado', updatedAt: daysAgoIso(2) })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.sin_movimiento_7d).toBe(1)
  })

  // Un lead captado o perdido no le debe una llamada a nadie.
  it('no cuenta como atrasados los cerrados ni los ganados', async () => {
    await insertLead({ stage: 'captado', updatedAt: daysAgoIso(90) })
    await insertLead({ stage: 'perdido', updatedAt: daysAgoIso(90) })
    await insertLead({ stage: 'nuevo', createdAt: daysAgoIso(90), updatedAt: daysAgoIso(90) })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.sin_movimiento_7d).toBe(1)
    expect(agg?.sin_contactar_24h).toBe(1)
    expect(agg?.total).toBe(3)
  })

  it('devuelve los leads sin asignar en su propia fila', async () => {
    await insertLead({ stage: 'nuevo', assignedTo: null, createdAt: daysAgoIso(2) })
    await insertLead({ stage: 'nuevo' })

    const rows = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    const sinAsignar = rows.find(r => r.agent_id === null)
    expect(sinAsignar?.total).toBe(1)
    expect(sinAsignar?.sin_contactar_24h).toBe(1)
    expect(rows.find(r => r.agent_id === agentId)?.total).toBe(1)
  })

  // La 039 dejó `pipeline NOT NULL DEFAULT 'vendedor'`, así que los leads
  // viejos quedaron como vendedores y un NULL ya no entra. El COALESCE de la
  // query es defensivo; lo que importa es que los pipelines no se mezclen.
  it('separa el pipeline vendedor del de comprador', async () => {
    await insertLead({ stage: 'nuevo' })
    await insertLead({ stage: 'nuevo', pipeline: 'comprador' })

    const repo = new D1TeamStatsRepository(env.DB)
    const vendedor = await repo.aggregateLeadsByAgent(orgId, 'vendedor')
    const comprador = await repo.aggregateLeadsByAgent(orgId, 'comprador')
    expect(vendedor[0]?.total).toBe(1)
    expect(comprador[0]?.total).toBe(1)
  })

  it('devuelve el último movimiento en ISO, sin importar cómo esté guardado', async () => {
    await insertLead({ stage: 'contactado', updatedAt: daysAgoLegacy(1) })
    await insertLead({ stage: 'contactado', updatedAt: daysAgoIso(30) })

    const [agg] = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(orgId, 'vendedor')
    expect(agg?.ultimo_movimiento).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    // Gana el más reciente (el de ayer, guardado en formato legacy).
    const diffDays = (Date.now() - new Date(agg!.ultimo_movimiento!).getTime()) / 86400000
    expect(diffDays).toBeLessThan(2)
  })

  it('no mezcla organizaciones', async () => {
    await insertLead({ stage: 'nuevo' })
    const otherOrg = await seedOrg(env.DB)
    const rows = await new D1TeamStatsRepository(env.DB).aggregateLeadsByAgent(otherOrg.id, 'vendedor')
    expect(rows).toEqual([])
  })

  describe('aggregateFirstResponseByAgent', () => {
    it('cuenta los contactados dentro de las 24h', async () => {
      await leadContactadoEn(10, 2)
      await leadContactadoEn(10, 20)
      await leadContactadoEn(10, 50)

      const [r] = await new D1TeamStatsRepository(env.DB).aggregateFirstResponseByAgent(orgId, 'vendedor')
      expect(r?.medidos).toBe(3)
      expect(r?.en_24h).toBe(2)
    })

    it('saca la mediana de horas, no el promedio', async () => {
      // 1, 2, 300 → mediana 2. Un promedio daría 101.
      await leadContactadoEn(10, 1)
      await leadContactadoEn(10, 2)
      await leadContactadoEn(10, 300)

      const [r] = await new D1TeamStatsRepository(env.DB).aggregateFirstResponseByAgent(orgId, 'vendedor')
      expect(r?.mediana_horas).toBeCloseTo(2, 1)
    })

    it('con cantidad par promedia los dos del medio', async () => {
      await leadContactadoEn(10, 2)
      await leadContactadoEn(10, 4)
      await leadContactadoEn(10, 6)
      await leadContactadoEn(10, 100)

      const [r] = await new D1TeamStatsRepository(env.DB).aggregateFirstResponseByAgent(orgId, 'vendedor')
      expect(r?.mediana_horas).toBeCloseTo(5, 1)
    })

    it('separa los que nunca se contactaron de los que no se pueden medir', async () => {
      // Sigue en nuevo y venció: incumplido.
      await insertLead({ stage: 'nuevo', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() })
      // Avanzó sin registrar primer contacto: no hay con qué medirlo.
      await insertLead({ stage: 'captado', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() })
      // Recién creado: todavía no venció, no cuenta en ningún lado.
      await insertLead({ stage: 'nuevo' })

      const [r] = await new D1TeamStatsRepository(env.DB).aggregateFirstResponseByAgent(orgId, 'vendedor')
      expect(r?.nunca_contactados).toBe(1)
      expect(r?.sin_dato).toBe(1)
      expect(r?.medidos).toBe(0)
      expect(r?.mediana_horas).toBeNull()
    })

    it('no mezcla pipelines ni organizaciones', async () => {
      await leadContactadoEn(5, 1)
      const repo = new D1TeamStatsRepository(env.DB)

      expect((await repo.aggregateFirstResponseByAgent(orgId, 'comprador'))).toEqual([])
      const otra = await seedOrg(env.DB)
      expect((await repo.aggregateFirstResponseByAgent(otra.id, 'vendedor'))).toEqual([])
    })
  })
})
