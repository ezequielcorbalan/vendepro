import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnsureGoogleWatchUseCase } from '../../../src/application/use-cases/integrations/ensure-google-watch'
import { needsWatchRenewal, WATCH_RENEW_MARGIN_MS } from '../../../src/application/use-cases/integrations/google-watch-config'
import { UserIntegration } from '../../../src/domain/entities/user-integration'

/**
 * El canal es lo que hace que los eventos lleguen solos. Si vence y nadie lo
 * renueva no hay ningún error visible: el calendario del agente y el CRM se
 * separan en silencio. De ahí que estos casos importen tanto.
 */

const CREDS = JSON.stringify({
  refresh_token: 'r', access_token: 'a',
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
})

function makeIntegration(config: Record<string, unknown> = {}) {
  const i = UserIntegration.create({
    id: 'int1', org_id: 'org1', user_id: 'agente1', provider: 'google_calendar',
    credentials_encrypted: CREDS, enabled: true,
  })
  i.setConfig(config)
  return i
}

function makeDeps(over: { integration?: UserIntegration | null; watchFails?: boolean } = {}) {
  const integration = 'integration' in over ? over.integration : makeIntegration()
  const integrationRepo = {
    findByUserAndProvider: vi.fn().mockResolvedValue(integration),
    findByGoogleChannelId: vi.fn(), save: vi.fn(), delete: vi.fn(),
  }
  const gateway = {
    exchangeCode: vi.fn(), refreshAccessToken: vi.fn(), revokeToken: vi.fn(),
    listEvents: vi.fn(), createEvent: vi.fn(), updateEvent: vi.fn(), deleteEvent: vi.fn(),
    listChanges: vi.fn(),
    stopChannel: vi.fn(),
    watchEvents: over.watchFails
      ? vi.fn().mockRejectedValue(new Error('address no verificada'))
      : vi.fn().mockResolvedValue({ id: 'canal-nuevo', resource_id: 'recurso-1', expiration: 9_999_999_999_999 }),
  }
  let n = 0
  const useCase = new EnsureGoogleWatchUseCase(
    integrationRepo as any, gateway as any,
    { generate: () => `id-${++n}` },
    async (p: string) => p, async (c: string) => c,
  )
  return { useCase, integrationRepo, gateway }
}

beforeEach(() => vi.clearAllMocks())

describe('needsWatchRenewal', () => {
  it('pide renovar si nunca se abrió un canal', () => {
    expect(needsWatchRenewal({})).toBe(true)
  })

  it('pide renovar ANTES de que venza, no cuando ya venció', () => {
    // Renovar sobre la hora deja una ventana muerta: el cron no corre al
    // segundo exacto y en el medio los cambios no llegan.
    const now = Date.now()
    expect(needsWatchRenewal(
      { watch_channel_id: 'c', watch_expiration: now + WATCH_RENEW_MARGIN_MS - 1000 }, now,
    )).toBe(true)
  })

  it('no renueva un canal que todavía tiene margen', () => {
    const now = Date.now()
    expect(needsWatchRenewal(
      { watch_channel_id: 'c', watch_expiration: now + WATCH_RENEW_MARGIN_MS * 3 }, now,
    )).toBe(false)
  })
})

describe('EnsureGoogleWatchUseCase', () => {
  it('no abre canal si la cuenta no está conectada', async () => {
    const { useCase, gateway } = makeDeps({ integration: null })
    const r = await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })
    expect(r.watching).toBe(false)
    expect(r.reason).toBe('not_connected')
    expect(gateway.watchEvents).not.toHaveBeenCalled()
  })

  it('abre el canal y guarda id, recurso, vencimiento y token', async () => {
    const { useCase, integrationRepo, gateway } = makeDeps()

    const r = await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })

    expect(r).toMatchObject({ watching: true, renewed: true })
    const cfg = (integrationRepo.save.mock.calls[0]![0] as UserIntegration).getConfig()
    expect(cfg.watch_channel_id).toBe('canal-nuevo')
    expect(cfg.watch_resource_id).toBe('recurso-1')
    expect(cfg.watch_expiration).toBe(9_999_999_999_999)
    // El token que Google va a devolver en cada notificación.
    expect(typeof cfg.watch_token).toBe('string')
    expect(gateway.watchEvents.mock.calls[0]![1].address).toBe('https://api/hook')
  })

  it('no toca nada si el canal vigente todavía sirve', async () => {
    const integration = makeIntegration({
      watch_channel_id: 'c-vivo',
      watch_expiration: Date.now() + WATCH_RENEW_MARGIN_MS * 5,
    })
    const { useCase, gateway, integrationRepo } = makeDeps({ integration })

    const r = await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })

    expect(r).toMatchObject({ watching: true, renewed: false })
    expect(gateway.watchEvents).not.toHaveBeenCalled()
    expect(integrationRepo.save).not.toHaveBeenCalled()
  })

  it('con `force` renueva aunque el canal esté vigente', async () => {
    // Es lo que pasa al reconectar la cuenta: el canal viejo quedó atado a
    // credenciales que ya no son.
    const integration = makeIntegration({
      watch_channel_id: 'c-vivo',
      watch_expiration: Date.now() + WATCH_RENEW_MARGIN_MS * 5,
    })
    const { useCase, gateway } = makeDeps({ integration })

    const r = await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook', force: true })

    expect(r.renewed).toBe(true)
    expect(gateway.watchEvents).toHaveBeenCalled()
  })

  it('cierra el canal viejo antes de abrir el nuevo', async () => {
    // Si no, Google notifica por los dos hasta que el viejo venza y el CRM
    // sincroniza dos veces por cambio.
    const integration = makeIntegration({
      watch_channel_id: 'c-viejo', watch_resource_id: 'r-viejo', watch_expiration: 1,
    })
    const { useCase, gateway } = makeDeps({ integration })

    await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })

    expect(gateway.stopChannel).toHaveBeenCalledWith(expect.any(String), 'c-viejo', 'r-viejo')
  })

  it('si Google rechaza el canal, informa el motivo y no rompe la conexión', async () => {
    // El caso real: la URL del webhook todavía no está verificada en Google.
    // La cuenta igual queda conectada y el agente puede traer eventos a mano.
    const { useCase, integrationRepo } = makeDeps({ watchFails: true })

    const r = await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })

    expect(r.watching).toBe(false)
    expect(r.reason).toMatch(/address no verificada/)
    expect(integrationRepo.save).not.toHaveBeenCalled()
  })

  it('no pisa el resto de la config al guardar el canal', async () => {
    const integration = makeIntegration({ email: 'agente@inmobiliaria.com', auto_invite: true })
    const { useCase, integrationRepo } = makeDeps({ integration })

    await useCase.execute({ userId: 'agente1', webhookUrl: 'https://api/hook' })

    const cfg = (integrationRepo.save.mock.calls[0]![0] as UserIntegration).getConfig()
    expect(cfg.email).toBe('agente@inmobiliaria.com')
    expect(cfg.auto_invite).toBe(true)
    expect(cfg.watch_channel_id).toBe('canal-nuevo')
  })
})
