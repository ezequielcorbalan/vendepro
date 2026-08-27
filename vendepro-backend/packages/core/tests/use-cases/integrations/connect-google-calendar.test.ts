import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConnectGoogleCalendarUseCase } from '../../../src/application/use-cases/integrations/connect-google-calendar'
import { DisconnectGoogleCalendarUseCase } from '../../../src/application/use-cases/integrations/disconnect-google-calendar'
import { GetGoogleIntegrationUseCase } from '../../../src/application/use-cases/integrations/get-google-integration'
import { UserIntegration } from '../../../src/domain/entities/user-integration'

const mockRepo = {
  findByUserAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
}
const mockGateway = {
  exchangeCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn().mockResolvedValue(undefined),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}
const mockIds = { generate: vi.fn().mockReturnValue('uinteg-1') }
const encrypt = vi.fn(async (plain: string) => `enc(${plain})`)
const decrypt = vi.fn(async (cipher: string) => cipher.startsWith('enc(') ? cipher.slice(4, -1) : null)

describe('ConnectGoogleCalendarUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.findByUserAndProvider.mockResolvedValue(null)
    mockIds.generate.mockReturnValue('uinteg-1')
    mockGateway.exchangeCode.mockResolvedValue({
      access_token: 'at-1',
      refresh_token: 'rt-1',
      expires_in: 3600,
      email: 'agente@gmail.com',
    })
  })

  it('canjea el code, cifra las credenciales y habilita la integración', async () => {
    const uc = new ConnectGoogleCalendarUseCase(mockRepo, mockGateway, mockIds, encrypt)
    // findByUserAndProvider se llama de nuevo para la vista final
    mockRepo.findByUserAndProvider
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(async () => mockRepo.save.mock.calls[0][0])

    const view = await uc.execute({ orgId: 'org_mg', userId: 'user-1', code: 'code-abc', redirectUri: 'https://crm/cb' })

    expect(mockGateway.exchangeCode).toHaveBeenCalledWith('code-abc', 'https://crm/cb')
    const saved: UserIntegration = mockRepo.save.mock.calls[0][0]
    expect(saved.enabled).toBe(true)
    expect(saved.credentials_encrypted).toContain('enc(')
    const credentials = JSON.parse(saved.credentials_encrypted!.slice(4, -1))
    expect(credentials.refresh_token).toBe('rt-1')
    expect(credentials.access_token).toBe('at-1')
    // la vista pública nunca expone credenciales
    expect((view as any).credentials_encrypted).toBeUndefined()
    expect(view.connected).toBe(true)
    expect(view.email).toBe('agente@gmail.com')
    expect(view.auto_invite).toBe(true)
  })

  it('falla si Google no devuelve refresh_token', async () => {
    mockGateway.exchangeCode.mockResolvedValue({ access_token: 'at-1', refresh_token: null, expires_in: 3600 })
    const uc = new ConnectGoogleCalendarUseCase(mockRepo, mockGateway, mockIds, encrypt)

    await expect(
      uc.execute({ orgId: 'org_mg', userId: 'user-1', code: 'code-abc', redirectUri: 'https://crm/cb' }),
    ).rejects.toThrow(/refresh token/)
    expect(mockRepo.save).not.toHaveBeenCalled()
  })

  it('reconectar reutiliza la fila existente y preserva auto_invite=false', async () => {
    const existing = UserIntegration.create({
      id: 'uinteg-1', org_id: 'org_mg', user_id: 'user-1', provider: 'google_calendar',
      config_json: JSON.stringify({ auto_invite: false, email: 'viejo@gmail.com' }),
    })
    mockRepo.findByUserAndProvider
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
    const uc = new ConnectGoogleCalendarUseCase(mockRepo, mockGateway, mockIds, encrypt)

    const view = await uc.execute({ orgId: 'org_mg', userId: 'user-1', code: 'code-abc', redirectUri: 'https://crm/cb' })

    expect(mockRepo.save.mock.calls[0][0].id).toBe('uinteg-1')
    expect(view.auto_invite).toBe(false)
    expect(view.email).toBe('agente@gmail.com')
  })
})

describe('DisconnectGoogleCalendarUseCase', () => {
  beforeEach(() => vi.clearAllMocks())

  it('revoca el refresh token y borra la integración', async () => {
    const integration = UserIntegration.create({
      id: 'uinteg-1', org_id: 'org_mg', user_id: 'user-1', provider: 'google_calendar',
      credentials_encrypted: `enc(${JSON.stringify({ refresh_token: 'rt-1' })})`,
    })
    mockRepo.findByUserAndProvider.mockResolvedValue(integration)
    const uc = new DisconnectGoogleCalendarUseCase(mockRepo, mockGateway, decrypt)

    const result = await uc.execute({ userId: 'user-1' })

    expect(result.ok).toBe(true)
    expect(mockGateway.revokeToken).toHaveBeenCalledWith('rt-1')
    expect(mockRepo.delete).toHaveBeenCalledWith('user-1', 'google_calendar')
  })

  it('sin integración no falla', async () => {
    mockRepo.findByUserAndProvider.mockResolvedValue(null)
    const uc = new DisconnectGoogleCalendarUseCase(mockRepo, mockGateway, decrypt)
    await expect(uc.execute({ userId: 'user-1' })).resolves.toEqual({ ok: true })
    expect(mockRepo.delete).not.toHaveBeenCalled()
  })
})

describe('GetGoogleIntegrationUseCase', () => {
  it('sin fila devuelve el estado desconectado por defecto', async () => {
    mockRepo.findByUserAndProvider.mockResolvedValue(null)
    const view = await new GetGoogleIntegrationUseCase(mockRepo).execute({ userId: 'user-1' })
    expect(view).toEqual({ connected: false, enabled: false, auto_invite: true, email: null, last_sync_at: null, scopes: null })
  })
})
