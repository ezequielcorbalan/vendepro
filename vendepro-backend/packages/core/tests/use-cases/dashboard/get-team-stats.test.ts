import { describe, it, expect, vi } from 'vitest'
import { GetTeamStatsUseCase } from '../../../src/application/use-cases/dashboard/get-team-stats'
import { User } from '../../../src/domain/entities/user'
import type { AgentLeadAggregate } from '../../../src/application/ports/repositories/team-stats-repository'

function makeUser(id: string, fullName: string, role = 'agent') {
  return User.create({
    id,
    org_id: 'org1',
    email: `${id}@test.com`,
    password_hash: 'x',
    full_name: fullName,
    role: role as any,
    active: 1,
    phone: null,
    photo_url: null,
  })
}

/** Lo que devuelve la agregación de la base para un agente. */
function agg(agent_id: string | null, by_stage: Record<string, number>): AgentLeadAggregate {
  return {
    agent_id,
    by_stage,
    total: Object.values(by_stage).reduce((a, b) => a + b, 0),
    sin_contactar_24h: 0,
    sin_movimiento_7d: 0,
    ultimo_movimiento: null,
  }
}

function makeRepos(users: User[], aggregates: AgentLeadAggregate[], activity: Record<string, number>) {
  return {
    users: {
      findById: vi.fn(), findByEmail: vi.fn(),
      findByOrg: vi.fn().mockResolvedValue(users),
      findDeletedByOrg: vi.fn(), save: vi.fn(), delete: vi.fn(), restore: vi.fn(),
      updateRole: vi.fn(), findFirstAdminByOrg: vi.fn(), findProfileById: vi.fn(),
      updateProfile: vi.fn(),
    },
    teamStats: {
      aggregateLeadsByAgent: vi.fn().mockResolvedValue(aggregates),
    },
    activities: {
      findByOrg: vi.fn(), findById: vi.fn(), save: vi.fn(), delete: vi.fn(),
      findByOrgSince: vi.fn(), findLatestByOrg: vi.fn(), aggregateByTypeSince: vi.fn(),
      findByCalendarEventId: vi.fn(), deleteByCalendarEventId: vi.fn(),
      countByAgentSince: vi.fn().mockResolvedValue(activity),
    },
  }
}

describe('GetTeamStatsUseCase', () => {
  it('calcula leads, captados y conversión por agente', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Marcela Genta'), makeUser('a2', 'Felix Romero')],
      [
        agg('a1', { captado: 2, contactado: 1, nuevo: 1 }),
        agg('a2', { contactado: 1 }),
      ],
      { a1: 12, a2: 3 },
    )

    const result = await new GetTeamStatsUseCase(repos.users as any, repos.teamStats as any, repos.activities as any)
      .execute('org1')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 'a1',
      full_name: 'Marcela Genta',
      role: 'agent',
      total_leads: 4,
      captados: 2,
      conversion: 50,
      actividad_mes: 12,
    })
    expect(result[1]?.conversion).toBe(0)
  })

  it('pide sólo el pipeline vendedor: la meta de captación es "captado"', async () => {
    const repos = makeRepos([makeUser('a1', 'Marcela')], [], {})

    await new GetTeamStatsUseCase(repos.users as any, repos.teamStats as any, repos.activities as any).execute('org1')

    expect(repos.teamStats.aggregateLeadsByAgent).toHaveBeenCalledWith('org1', 'vendedor')
  })

  it('ordena por captados y desempata por leads', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Primero'), makeUser('a2', 'Segundo'), makeUser('a3', 'Tercero')],
      [
        agg('a1', { contactado: 1 }),
        agg('a2', { captado: 1 }),
        agg('a3', { captado: 1, nuevo: 1 }),
      ],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users as any, repos.teamStats as any, repos.activities as any)
      .execute('org1')

    expect(result.map(a => a.id)).toEqual(['a3', 'a2', 'a1'])
  })

  it('deja fuera a los usuarios sin leads ni actividad', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Comercial'), makeUser('admin1', 'Administrativa', 'admin')],
      [agg('a1', { nuevo: 1 })],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users as any, repos.teamStats as any, repos.activities as any)
      .execute('org1')

    expect(result.map(a => a.id)).toEqual(['a1'])
  })

  it('ignora los leads sin agente asignado', async () => {
    const repos = makeRepos(
      [makeUser('a1', 'Comercial')],
      [agg(null, { captado: 1 }), agg('a1', { captado: 1 })],
      {},
    )

    const result = await new GetTeamStatsUseCase(repos.users as any, repos.teamStats as any, repos.activities as any)
      .execute('org1')

    expect(result[0]?.total_leads).toBe(1)
  })
})
