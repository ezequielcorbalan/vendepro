import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessUnsubscribeUseCase } from '../../../src/application/use-cases/marketing/process-unsubscribe'

function makeSigner(payload: { orgId: string; email: string } | null) {
  return { sign: vi.fn(), verify: vi.fn().mockResolvedValue(payload) } as any
}

function makeSuppressionRepo() {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    findByEmail: vi.fn(),
    listByOrg: vi.fn(),
    remove: vi.fn(),
  } as any
}

const idGen = { generate: () => 'sup_1' }

describe('ProcessUnsubscribeUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('da de baja el email del token firmado', async () => {
    const repo = makeSuppressionRepo()
    const uc = new ProcessUnsubscribeUseCase(
      makeSigner({ orgId: 'org_mg', email: 'Cliente@Test.com' }),
      repo,
      idGen,
    )
    const result = await uc.execute('token-valido')

    expect(result).toEqual({ ok: true, email: 'cliente@test.com' })
    const saved = repo.add.mock.calls[0][0].toObject()
    expect(saved.org_id).toBe('org_mg')
    expect(saved.email).toBe('cliente@test.com')
    expect(saved.reason).toBe('unsubscribe')
    expect(saved.source).toBe('link')
  })

  it('token inválido → ok:false sin tocar la lista', async () => {
    const repo = makeSuppressionRepo()
    const uc = new ProcessUnsubscribeUseCase(makeSigner(null), repo, idGen)
    const result = await uc.execute('token-trucho')

    expect(result).toEqual({ ok: false, email: null })
    expect(repo.add).not.toHaveBeenCalled()
  })
})
