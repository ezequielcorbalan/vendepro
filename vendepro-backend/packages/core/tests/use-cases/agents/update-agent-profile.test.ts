import { describe, it, expect, vi } from 'vitest'
import { UpdateAgentProfileUseCase } from '../../../src/application/use-cases/agents/update-agent-profile'
import { AgentProfile, type AgentProfilePatch } from '../../../src/domain/entities/agent-profile'

function makeDeps(existing: AgentProfile | null = null, taken = false) {
  const saved: AgentProfile[] = []
  return {
    saved,
    repo: {
      findByUserId: vi.fn(async () => existing),
      findByOrgAndSlug: vi.fn(),
      existsSlug: vi.fn(async () => taken),
      save: vi.fn(async (p: AgentProfile) => { saved.push(p) }),
    },
  }
}

describe('UpdateAgentProfileUseCase', () => {
  it('crea el perfil si no existe, con slug derivado del nombre', async () => {
    const d = makeDeps(null)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    const out = await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { bio: 'Hola' } })
    expect(out.slug).toBe('andres-giunta')
    expect(out.bio).toBe('Hola')
    expect(d.saved).toHaveLength(1)
  })

  it('actualiza el perfil existente sin tocar el slug si no se pasa', async () => {
    const existing = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', bio: 'viejo' })
    const d = makeDeps(existing)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    const out = await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { bio: 'nuevo', is_public: true } })
    expect(out.slug).toBe('andres-giunta')
    expect(out.bio).toBe('nuevo')
    expect(out.is_public).toBe(true)
  })

  it('rechaza un slug con forma inválida', async () => {
    const d = makeDeps(null)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await expect(uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { slug: 'NO VALIDO' } })).rejects.toThrow(/slug/i)
  })

  it('rechaza un slug ya tomado en la org', async () => {
    const d = makeDeps(null, true)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await expect(uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { slug: 'tomado' } })).rejects.toThrow(/en uso|tomado|disponible/i)
  })

  it('permite conservar el slug propio (existsSlug excluye al usuario)', async () => {
    const existing = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta' })
    const d = makeDeps(existing, false)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch: { slug: 'andres-giunta' } })
    expect(d.repo.existsSlug).toHaveBeenCalledWith('o1', 'andres-giunta', 'u1')
  })

  // Regresión: la ruta arma el patch con `slug: body.slug` sin fallback, así que cuando el
  // cliente no manda slug la key queda presente con valor `undefined` (no ausente). Un
  // `{ ...props, ...patch }` ingenuo pisa el slug persistido con `undefined`. Este test
  // reproduce esa forma exacta de patch, no la de "key omitida" de los tests de arriba.
  it('conserva el slug persistido cuando el patch trae la key slug con undefined explícito', async () => {
    const existing = AgentProfile.create({ user_id: 'u1', org_id: 'o1', slug: 'andres-giunta', bio: 'viejo' })
    const d = makeDeps(existing)
    const uc = new UpdateAgentProfileUseCase(d.repo as any)
    const patch: AgentProfilePatch = { slug: undefined, bio: 'nuevo' }
    const out = await uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'Andrés Giunta', patch })
    expect(out.slug).toBe('andres-giunta')
    expect(out.bio).toBe('nuevo')
  })

  describe('validación de years_experience', () => {
    it('rechaza un valor negativo', async () => {
      const d = makeDeps(null)
      const uc = new UpdateAgentProfileUseCase(d.repo as any)
      await expect(
        uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { years_experience: -1 } }),
      ).rejects.toThrow(/años de experiencia/i)
    })

    it('rechaza un valor mayor a 70', async () => {
      const d = makeDeps(null)
      const uc = new UpdateAgentProfileUseCase(d.repo as any)
      await expect(
        uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { years_experience: 71 } }),
      ).rejects.toThrow(/años de experiencia/i)
    })

    it('rechaza un valor no entero', async () => {
      const d = makeDeps(null)
      const uc = new UpdateAgentProfileUseCase(d.repo as any)
      await expect(
        uc.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { years_experience: 4.5 } }),
      ).rejects.toThrow(/años de experiencia/i)
    })

    it('acepta los límites 0 y 70', async () => {
      const d1 = makeDeps(null)
      const uc1 = new UpdateAgentProfileUseCase(d1.repo as any)
      const out1 = await uc1.execute({ orgId: 'o1', userId: 'u1', fullName: 'A B', patch: { years_experience: 0 } })
      expect(out1.years_experience).toBe(0)

      const d2 = makeDeps(null)
      const uc2 = new UpdateAgentProfileUseCase(d2.repo as any)
      const out2 = await uc2.execute({ orgId: 'o1', userId: 'u2', fullName: 'A B', patch: { years_experience: 70 } })
      expect(out2.years_experience).toBe(70)
    })
  })
})
