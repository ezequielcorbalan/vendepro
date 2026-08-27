import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListGoogleCalendarEventsUseCase } from '../../../src/application/use-cases/integrations/list-google-calendar-events'
import { UserIntegration } from '../../../src/domain/entities/user-integration'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'

const mockIntegrationRepo = {
  findByUserAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockCalendarRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn().mockResolvedValue([]),
  save: vi.fn(),
  delete: vi.fn(),
  findByOrgAndDate: vi.fn(),
  setGoogleMeta: vi.fn(),
}
const mockGateway = {
  exchangeCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn(),
  listEvents: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}
const encrypt = vi.fn(async (plain: string) => `enc(${plain})`)
const decrypt = vi.fn(async (c: string) => (c.startsWith('enc(') ? c.slice(4, -1) : null))

const RANGE = { orgId: 'org_mg', userId: 'agent-1', start: '2026-08-01T00:00:00Z', end: '2026-08-31T23:59:59Z' }

function connected(creds: Record<string, unknown> = {}) {
  return UserIntegration.create({
    id: 'ui-1', org_id: 'org_mg', user_id: 'agent-1', provider: 'google_calendar',
    enabled: true,
    credentials_encrypted: `enc(${JSON.stringify({
      refresh_token: 'rt-1',
      access_token: 'at-fresco',
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      ...creds,
    })})`,
  })
}

function googleEvent(id: string, summary = 'Reunión') {
  return {
    id, summary, description: null,
    start: '2026-08-10T15:00:00Z', end: '2026-08-10T16:00:00Z',
    all_day: false, html_link: null, status: 'confirmed',
  }
}

function ownEvent(googleEventId: string | null) {
  return CalendarEvent.create({
    id: `local-${googleEventId ?? 'none'}`, org_id: 'org_mg', agent_id: 'agent-1',
    title: 'Visita', event_type: 'visita_comprador',
    start_at: '2026-08-10T15:00', end_at: null, all_day: 0,
    description: null, lead_id: null, contact_id: null, property_id: null,
    appraisal_id: null, reservation_id: null, color: null, completed: 0,
    google_event_id: googleEventId,
  } as any)
}

function useCase() {
  return new ListGoogleCalendarEventsUseCase(
    mockIntegrationRepo as any, mockCalendarRepo as any, mockGateway as any, encrypt, decrypt,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCalendarRepo.findByOrg.mockResolvedValue([])
  mockGateway.listEvents.mockResolvedValue([])
  mockIntegrationRepo.save.mockResolvedValue(undefined)
})

describe('ListGoogleCalendarEventsUseCase', () => {
  it('sin integración devuelve not_connected, no una lista vacía a secas', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(null)

    const result = await useCase().execute(RANGE)

    // El UI distingue "no conectaste tu cuenta" de "no tenés eventos".
    expect(result).toEqual({ events: [], connected: false, reason: 'not_connected' })
    expect(mockGateway.listEvents).not.toHaveBeenCalled()
  })

  it('con la integración deshabilitada tampoco consulta a Google', async () => {
    const integration = connected()
    integration.update({ enabled: false })
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(integration)

    const result = await useCase().execute(RANGE)
    expect(result.connected).toBe(false)
    expect(mockGateway.listEvents).not.toHaveBeenCalled()
  })

  it('pide a Google exactamente el rango solicitado', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connected())

    await useCase().execute(RANGE)

    expect(mockGateway.listEvents).toHaveBeenCalledWith('at-fresco', {
      timeMin: RANGE.start,
      timeMax: RANGE.end,
    })
  })

  it('filtra los eventos que el CRM ya espejó, para no mostrarlos dos veces', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connected())
    mockGateway.listEvents.mockResolvedValue([
      googleEvent('gcal-1', 'Visita espejada desde el CRM'),
      googleEvent('gcal-2', 'Almuerzo personal'),
    ])
    mockCalendarRepo.findByOrg.mockResolvedValue([ownEvent('gcal-1'), ownEvent(null)])

    const result = await useCase().execute(RANGE)

    expect(result.events.map((e) => e.id)).toEqual(['gcal-2'])
  })

  it('si no puede leer los eventos propios, muestra de más antes que romper', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connected())
    mockGateway.listEvents.mockResolvedValue([googleEvent('gcal-1')])
    mockCalendarRepo.findByOrg.mockRejectedValue(new Error('D1 caído'))

    const result = await useCase().execute(RANGE)
    expect(result.events).toHaveLength(1)
    expect(result.connected).toBe(true)
  })

  it('refresca el access token vencido y lo persiste', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(
      connected({ access_token: 'at-viejo', expires_at: new Date(Date.now() - 60_000).toISOString() }),
    )
    mockGateway.refreshAccessToken.mockResolvedValue({ access_token: 'at-nuevo', expires_in: 3600 })

    await useCase().execute(RANGE)

    expect(mockGateway.refreshAccessToken).toHaveBeenCalledWith('rt-1')
    expect(mockGateway.listEvents).toHaveBeenCalledWith('at-nuevo', expect.anything())
    // Se guarda para que el próximo request no vuelva a refrescar.
    expect(mockIntegrationRepo.save).toHaveBeenCalled()
  })

  it('sin refresh token no intenta nada: las credenciales no sirven', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(
      connected({ refresh_token: undefined as any }),
    )

    const result = await useCase().execute(RANGE)
    expect(result).toEqual({ events: [], connected: false, reason: 'invalid_credentials' })
  })
})
