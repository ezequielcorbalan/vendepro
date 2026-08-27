import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncEventToGoogleUseCase } from '../../../src/application/use-cases/integrations/sync-event-to-google'
import { UserIntegration } from '../../../src/domain/entities/user-integration'
import { CalendarEvent } from '../../../src/domain/entities/calendar-event'

const mockIntegrationRepo = {
  findByUserAndProvider: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn(),
}
const mockCalendarRepo = {
  findById: vi.fn(),
  findByOrg: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
  findByOrgAndDate: vi.fn(),
  setGoogleMeta: vi.fn().mockResolvedValue(undefined),
}
const mockContactRepo = { findById: vi.fn() } as any
const mockGateway = {
  exchangeCode: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn(),
  createEvent: vi.fn().mockResolvedValue({ id: 'gcal-evt-1' }),
  updateEvent: vi.fn().mockResolvedValue(undefined),
  deleteEvent: vi.fn().mockResolvedValue(undefined),
}
const encrypt = vi.fn(async (plain: string) => `enc(${plain})`)
const decrypt = vi.fn(async (cipher: string) => cipher.startsWith('enc(') ? cipher.slice(4, -1) : null)

function connectedIntegration(creds: Record<string, unknown> = {}, config?: Record<string, unknown>) {
  const integration = UserIntegration.create({
    id: 'uinteg-1', org_id: 'org_mg', user_id: 'agent-1', provider: 'google_calendar',
    enabled: true,
    credentials_encrypted: `enc(${JSON.stringify({
      refresh_token: 'rt-1',
      access_token: 'at-fresco',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ...creds,
    })})`,
  })
  if (config) integration.setConfig(config)
  return integration
}

function localEvent(overrides: Record<string, unknown> = {}) {
  return CalendarEvent.create({
    id: 'evt-1', org_id: 'org_mg', agent_id: 'agent-1',
    title: 'Visita depto Palermo', event_type: 'visita_comprador',
    start_at: '2026-07-10T15:00', end_at: null, all_day: 0,
    description: 'Av. Santa Fe 3200', lead_id: null, contact_id: null,
    property_id: null, appraisal_id: null, reservation_id: null,
    color: null, completed: 0,
    ...overrides,
  } as any)
}

function makeUseCase() {
  return new SyncEventToGoogleUseCase(
    mockIntegrationRepo, mockCalendarRepo as any, mockContactRepo, mockGateway, encrypt, decrypt,
  )
}

describe('SyncEventToGoogleUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGateway.createEvent.mockResolvedValue({ id: 'gcal-evt-1' })
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connectedIntegration())
    mockCalendarRepo.findById.mockResolvedValue(localEvent())
    mockContactRepo.findById.mockResolvedValue(null)
  })

  it('sin conexión Google devuelve synced:false sin llamar al gateway', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(null)
    const result = await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert' })
    expect(result).toEqual({ synced: false, inviteSent: false, reason: 'not_connected' })
    expect(mockGateway.createEvent).not.toHaveBeenCalled()
  })

  it('crea el evento en Google con el cliente invitado y guarda el vínculo', async () => {
    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert',
      attendeeEmail: 'cliente@mail.com',
    })

    expect(result.synced).toBe(true)
    expect(result.inviteSent).toBe(true)
    const [token, payload] = mockGateway.createEvent.mock.calls[0]
    expect(token).toBe('at-fresco')
    expect(payload.summary).toBe('Visita depto Palermo')
    expect(payload.attendees).toEqual(['cliente@mail.com'])
    expect(payload.startIso).toBe('2026-07-10T15:00:00')
    expect(payload.endIso).toBe('2026-07-10T16:00:00') // sin end_at: +1h
    expect(payload.timeZone).toBe('America/Argentina/Buenos_Aires')
    expect(mockCalendarRepo.setGoogleMeta).toHaveBeenCalledWith('evt-1', 'org_mg', 'gcal-evt-1', expect.any(String))
  })

  it('usa el email del contacto vinculado cuando no viene explícito', async () => {
    mockCalendarRepo.findById.mockResolvedValue(localEvent({ contact_id: 'contact-9' }))
    mockContactRepo.findById.mockResolvedValue({ email: 'dueño@mail.com' })

    const result = await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert' })

    expect(mockContactRepo.findById).toHaveBeenCalledWith('contact-9', 'org_mg')
    expect(mockGateway.createEvent.mock.calls[0][1].attendees).toEqual(['dueño@mail.com'])
    expect(result.inviteSent).toBe(true)
  })

  it('sin email de cliente sincroniza igual pero inviteSent:false', async () => {
    const result = await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert' })
    expect(result).toEqual({ synced: true, inviteSent: false })
    expect(mockGateway.createEvent.mock.calls[0][1].attendees).toEqual([])
    expect(mockCalendarRepo.setGoogleMeta).toHaveBeenCalledWith('evt-1', 'org_mg', 'gcal-evt-1', null)
  })

  it('si el evento ya tiene espejo hace update en vez de create', async () => {
    mockCalendarRepo.findById.mockResolvedValue(localEvent({ google_event_id: 'gcal-evt-1' }))
    const result = await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert' })

    expect(mockGateway.updateEvent).toHaveBeenCalledWith('at-fresco', 'gcal-evt-1', expect.anything())
    expect(mockGateway.createEvent).not.toHaveBeenCalled()
    expect(result.synced).toBe(true)
  })

  it('refresca el access token vencido y persiste las credenciales nuevas', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(
      connectedIntegration({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    )
    mockGateway.refreshAccessToken.mockResolvedValue({ access_token: 'at-nuevo', expires_in: 3600 })

    await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', eventId: 'evt-1', action: 'upsert' })

    expect(mockGateway.refreshAccessToken).toHaveBeenCalledWith('rt-1')
    expect(mockGateway.createEvent.mock.calls[0][0]).toBe('at-nuevo')
    const saved: UserIntegration = mockIntegrationRepo.save.mock.calls[0][0]
    expect(saved.credentials_encrypted).toContain('at-nuevo')
  })

  it('delete borra el espejo en Google usando googleEventId', async () => {
    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', action: 'delete', googleEventId: 'gcal-evt-1',
    })
    expect(mockGateway.deleteEvent).toHaveBeenCalledWith('at-fresco', 'gcal-evt-1')
    expect(result.synced).toBe(true)
  })

  it('delete sin googleEventId no hace nada', async () => {
    const result = await makeUseCase().execute({ orgId: 'org_mg', agentId: 'agent-1', action: 'delete' })
    expect(result.reason).toBe('no_google_event')
    expect(mockGateway.deleteEvent).not.toHaveBeenCalled()
  })
})

describe('auto_invite — el setting del agente manda', () => {
  beforeEach(() => {
    // El clearAllMocks del describe de arriba no alcanza a este bloque.
    vi.clearAllMocks()
    mockGateway.createEvent.mockResolvedValue({ id: 'gcal-evt-1' })
    mockCalendarRepo.setGoogleMeta.mockResolvedValue(undefined)
    mockCalendarRepo.findById.mockResolvedValue(localEvent({ contact_id: 'contact-1' }))
    mockContactRepo.findById.mockResolvedValue({ id: 'contact-1', email: 'cliente@mail.com' })
  })

  it('con auto_invite activo, invita al cliente y Google le manda el mail', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connectedIntegration({}, { auto_invite: true }))

    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', action: 'upsert', eventId: 'evt-1',
    })

    expect(result.inviteSent).toBe(true)
    expect(mockGateway.createEvent.mock.calls[0][1].attendees).toEqual(['cliente@mail.com'])
  })

  it('con auto_invite apagado NO invita, aunque haya email del contacto', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connectedIntegration({}, { auto_invite: false }))

    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', action: 'upsert', eventId: 'evt-1',
    })

    // El evento igual se espeja en el calendario del agente: lo que se apaga
    // es la invitación al cliente, no la sincronización.
    expect(result.synced).toBe(true)
    expect(result.inviteSent).toBe(false)
    expect(mockGateway.createEvent.mock.calls[0][1].attendees).toEqual([])
  })

  it('con auto_invite apagado ignora también el email pasado explícitamente', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connectedIntegration({}, { auto_invite: false }))

    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', action: 'upsert', eventId: 'evt-1',
      attendeeEmail: 'otro@mail.com',
    })

    expect(result.inviteSent).toBe(false)
    expect(mockGateway.createEvent.mock.calls[0][1].attendees).toEqual([])
  })

  it('sin config guardada, el default es invitar', async () => {
    mockIntegrationRepo.findByUserAndProvider.mockResolvedValue(connectedIntegration())

    const result = await makeUseCase().execute({
      orgId: 'org_mg', agentId: 'agent-1', action: 'upsert', eventId: 'evt-1',
    })

    expect(result.inviteSent).toBe(true)
  })
})
