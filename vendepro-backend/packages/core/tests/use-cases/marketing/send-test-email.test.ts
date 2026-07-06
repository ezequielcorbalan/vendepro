import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendTestEmailUseCase } from '../../../src/application/use-cases/marketing/send-test-email'
import { EmailSettings } from '../../../src/domain/entities/email-settings'

const settings = EmailSettings.fromPersistence({
  org_id: 'org_mg',
  from_name: 'Marcela Genta',
  from_email: 'hola@mg.com',
  reply_to: 'respuestas@mg.com',
  enabled: false,
  resend_domain_id: null,
  domain_status: 'unverified',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
})

function makeSettingsRepo(existing: EmailSettings | null) {
  return { findByOrg: vi.fn().mockResolvedValue(existing), save: vi.fn() } as any
}

function makeEmailService(fail = false) {
  return {
    send: fail
      ? vi.fn().mockRejectedValue(new Error('Resend: domain not verified'))
      : vi.fn().mockResolvedValue(undefined),
  } as any
}

describe('SendTestEmailUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envía usando el remitente y reply_to configurados', async () => {
    const emailService = makeEmailService()
    const uc = new SendTestEmailUseCase(makeSettingsRepo(settings), emailService)
    const result = await uc.execute({ orgId: 'org_mg', to: 'Gaston@Test.com' })

    expect(result.ok).toBe(true)
    const sent = emailService.send.mock.calls[0][0]
    expect(sent.from).toEqual({ email: 'hola@mg.com', name: 'Marcela Genta' })
    expect(sent.to.email).toBe('gaston@test.com') // normalizado
    expect(sent.replyTo).toBe('respuestas@mg.com')
    expect(sent.tags).toEqual({ kind: 'test' })
  })

  it('funciona aunque enabled=false (el test es previo a habilitar)', async () => {
    const emailService = makeEmailService()
    const uc = new SendTestEmailUseCase(makeSettingsRepo(settings), emailService)
    const result = await uc.execute({ orgId: 'org_mg', to: 'x@y.com' })
    expect(result.ok).toBe(true)
  })

  it('falla con mensaje claro si no hay from_email configurado', async () => {
    const uc = new SendTestEmailUseCase(makeSettingsRepo(null), makeEmailService())
    await expect(uc.execute({ orgId: 'org_mg', to: 'x@y.com' })).rejects.toThrow(/remitente/)
  })

  it('rechaza destino inválido', async () => {
    const uc = new SendTestEmailUseCase(makeSettingsRepo(settings), makeEmailService())
    await expect(uc.execute({ orgId: 'org_mg', to: 'nope' })).rejects.toThrow(/inválido/)
  })

  it('devuelve el error del provider sin lanzar (para mostrarlo en UI)', async () => {
    const uc = new SendTestEmailUseCase(makeSettingsRepo(settings), makeEmailService(true))
    const result = await uc.execute({ orgId: 'org_mg', to: 'x@y.com' })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/domain not verified/)
  })
})
