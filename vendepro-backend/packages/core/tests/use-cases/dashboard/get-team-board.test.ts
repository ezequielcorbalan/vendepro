import { describe, it, expect, vi } from 'vitest'
import { GetTeamBoardUseCase } from '../../../src/application/use-cases/dashboard/get-team-board'
import { User } from '../../../src/domain/entities/user'
import type { AgentLeadAggregate } from '../../../src/application/ports/repositories/team-stats-repository'

const user = (id: string, full_name: string, role = 'agent') =>
  User.create({ id, org_id: 'org_mg', email: `${id}@test.com`, password_hash: 'x', full_name, role, active: 1 } as any)

const agg = (agent_id: string | null, by_stage: Record<string, number>, extra: Partial<AgentLeadAggregate> = {}): AgentLeadAggregate => ({
  agent_id,
  by_stage,
  total: Object.values(by_stage).reduce((a, b) => a + b, 0),
  sin_contactar_24h: 0,
  sin_movimiento_7d: 0,
  ultimo_movimiento: null,
  ...extra,
})

function build(aggregates: AgentLeadAggregate[], activity: Record<string, number> = {}) {
  return new GetTeamBoardUseCase(
    { findByOrg: vi.fn(async () => [user('a1', 'Ana'), user('a2', 'Beto'), user('a3', 'Sin nada')]) } as any,
    { aggregateLeadsByAgent: vi.fn(async () => aggregates) } as any,
    { countByAgentSince: vi.fn(async () => activity) } as any,
  )
}

describe('GetTeamBoardUseCase', () => {
  it('calcula activos, captados y conversión por agente', async () => {
    const board = await build([
      agg('a1', { nuevo: 2, contactado: 3, captado: 5, perdido: 10 }),
    ]).execute('org_mg')

    const ana = board.agents.find(a => a.id === 'a1')!
    expect(ana.total_leads).toBe(20)
    expect(ana.captados).toBe(5)
    expect(ana.conversion).toBe(25)
    // Activos = ni captado ni terminales (perdido).
    expect(ana.activos).toBe(5)
    expect(ana.por_etapa).toEqual({ nuevo: 2, contactado: 3, captado: 5, perdido: 10 })
  })

  it('conversión 0 sin leads, sin dividir por cero', async () => {
    const board = await build([], { a1: 4 }).execute('org_mg')
    const ana = board.agents.find(a => a.id === 'a1')!
    expect(ana.total_leads).toBe(0)
    expect(ana.conversion).toBe(0)
    expect(ana.actividad_mes).toBe(4)
  })

  it('deja fuera a quien no tiene leads ni actividad', async () => {
    const board = await build([agg('a1', { nuevo: 1 })], { a2: 3 }).execute('org_mg')
    expect(board.agents.map(a => a.id)).toEqual(['a1', 'a2'])
  })

  it('ordena primero a quien tiene trabajo atrasado', async () => {
    const board = await build([
      agg('a1', { captado: 50 }),
      agg('a2', { nuevo: 3 }, { sin_contactar_24h: 3 }),
    ]).execute('org_mg')
    expect(board.agents[0]!.id).toBe('a2')
  })

  it('separa la cola sin asignar', async () => {
    const board = await build([
      agg(null, { nuevo: 7 }, { sin_contactar_24h: 4 }),
      agg('a1', { nuevo: 1 }),
    ]).execute('org_mg')

    expect(board.sin_asignar).toEqual({ total: 7, sin_contactar_24h: 4 })
    // La cola no se cuenta como leads de nadie.
    expect(board.agents.map(a => a.id)).toEqual(['a1'])
    expect(board.totales.total_leads).toBe(1)
  })

  it('suma los totales de la inmobiliaria', async () => {
    const board = await build([
      agg('a1', { nuevo: 2, captado: 2 }, { sin_contactar_24h: 1 }),
      agg('a2', { contactado: 4, captado: 2 }, { sin_movimiento_7d: 2 }),
    ]).execute('org_mg')

    expect(board.totales.total_leads).toBe(10)
    expect(board.totales.captados).toBe(4)
    expect(board.totales.conversion).toBe(40)
    expect(board.totales.sin_contactar_24h).toBe(1)
    expect(board.totales.sin_movimiento_7d).toBe(2)
  })

  // En comprador la meta es `cerrado`, no `captado`.
  it('usa la etapa ganada del pipeline comprador', async () => {
    const board = await build([
      agg('a1', { nuevo: 2, visita_agendada: 2, cerrado: 4 }),
    ]).execute('org_mg', 'comprador')

    const ana = board.agents.find(a => a.id === 'a1')!
    expect(ana.captados).toBe(4)
    expect(ana.conversion).toBe(50)
    expect(ana.activos).toBe(4)
    expect(board.pipeline).toBe('comprador')
  })
})
