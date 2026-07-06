import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SaveEmailSettingsUseCase } from '../../../src/application/use-cases/marketing/save-email-settings'
import { EmailSettings } from '../../../src/domain/entities/email-settings'

function makeRepo(existing: EmailSettings | null = null) {
  return {
    findByOrg: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockResolvedValue(undefined),
  } as any
}

function savedObject(repo: any) {
  return repo.save.mock.calls[0][0].toObject()
}

describe('SaveEmailSettingsUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('crea la config la primera vez', async () => {
    const repo = makeRepo(null)
    const uc = new SaveEmailSettingsUseCase(repo)
    await uc.execute({
      orgId: 'org_mg',
      from_name: 'Marcela Genta',
      from_email: 'Hola@MarcelaGenta.com',
      enabled: true,
    })

    const o = savedObject(repo)
    expect(o.from_name).toBe('Marcela Genta')
    expect(o.from_email).toBe('hola@marcelagenta.com') // normalizado a lowercase
    expect(o.enabled).toBe(true)
  })

  it('rechaza habilitar sin from_email', async () => {
    const repo = makeRepo(null)
    const uc = new SaveEmailSettingsUseCase(repo)
    await expect(uc.execute({ orgId: 'org_mg', enabled: true })).rejects.toThrow(/remitente/)
  })

  it('rechaza un from_email con formato inválido', async () => {
    const repo = makeRepo(null)
    const uc = new SaveEmailSettingsUseCase(repo)
    await expect(uc.execute({ orgId: 'org_mg', from_email: 'no-es-email' })).rejects.toThrow(/inválido/)
  })

  it("'' o null limpian el campo; undefined lo preserva", async () => {
    const existing = EmailSettings.fromPersistence({
      org_id: 'org_mg',
      from_name: 'Marcela',
      from_email: 'hola@mg.com',
      reply_to: 'respuestas@mg.com',
      enabled: false,
      resend_domain_id: null,
      domain_status: 'unverified',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    const repo = makeRepo(existing)
    const uc = new SaveEmailSettingsUseCase(repo)
    await uc.execute({ orgId: 'org_mg', reply_to: '', from_name: null })

    const o = savedObject(repo)
    expect(o.reply_to).toBeNull()          // '' limpia
    expect(o.from_name).toBeNull()         // null limpia
    expect(o.from_email).toBe('hola@mg.com') // undefined preserva
  })

  it('no permite quedar habilitado si se limpia el from_email', async () => {
    const existing = EmailSettings.fromPersistence({
      org_id: 'org_mg',
      from_name: null,
      from_email: 'hola@mg.com',
      reply_to: null,
      enabled: true,
      resend_domain_id: null,
      domain_status: 'verified',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    const repo = makeRepo(existing)
    const uc = new SaveEmailSettingsUseCase(repo)
    await expect(uc.execute({ orgId: 'org_mg', from_email: '' })).rejects.toThrow(/remitente/)
  })
})
